import { execFileSync } from 'child_process';
import { usb } from 'usb';
import { DevicesIds as HiMDDevicesIds } from 'himd-js';
import { DevicesIds as NetMDDevicesIds } from 'netmd-js';

type WindowsUsbDriver = {
    instanceId: string;
    service?: string;
    name?: string;
};

type UsbIdentity = {
    vendorId: number;
    productId: number;
};

type DeviceTransport = {
    busNumber?: number;
    deviceAddress?: number;
    name?: string;
};

function toHex(value: number) {
    return `0x${value.toString(16).padStart(4, '0')}`;
}

function inspectWindowsUsbDrivers(): WindowsUsbDriver[] {
    if (process.platform !== 'win32') return [];
    const command = [
        "$ErrorActionPreference = 'Stop'",
        "$devices = Get-CimInstance Win32_PnPEntity -Filter \"PNPDeviceID LIKE 'USB\\\\VID_%'\"",
        '$result = @($devices | ForEach-Object { [PSCustomObject]@{ instanceId = $_.PNPDeviceID; service = $_.Service; name = $_.Name } })',
        '$result | ConvertTo-Json -Compress',
    ].join('; ');
    try {
        const output = execFileSync(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
            { encoding: 'utf8', timeout: 10000, windowsHide: true },
        ).trim();
        if (!output) return [];
        const parsed = JSON.parse(output);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
        console.warn('Windows USB 드라이버 상태를 읽지 못했습니다.', error);
        return [];
    }
}

function getWindowsUsbIdentity(instanceId: string): UsbIdentity | null {
    const match = /^USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(instanceId);
    if (!match) return null;
    return {
        vendorId: Number.parseInt(match[1], 16),
        productId: Number.parseInt(match[2], 16),
    };
}

function getWindowsDriverStatus(
    drivers: WindowsUsbDriver[],
    vendorId: number,
    productId: number,
) {
    if (process.platform !== 'win32') return { driverStatus: 'not-applicable' };
    const vid = vendorId.toString(16).padStart(4, '0').toUpperCase();
    const pid = productId.toString(16).padStart(4, '0').toUpperCase();
    const driver = drivers.find(entry =>
        entry.instanceId.toUpperCase().includes(`VID_${vid}&PID_${pid}`),
    );
    const driverName = driver?.service?.trim();
    const driverInstanceId = driver?.instanceId;
    if (!driverName) return { driverStatus: 'unknown', driverInstanceId };
    const normalized = driverName.toLowerCase();
    if (normalized === 'winusb') return { driverStatus: 'winusb', driverName, driverInstanceId };
    if (normalized === 'usbstor') return { driverStatus: 'usbstor', driverName, driverInstanceId };
    return { driverStatus: 'other', driverName, driverInstanceId };
}

function describeMiniDiscDevice(
    vendorId: number,
    productId: number,
    windowsDrivers: WindowsUsbDriver[],
    transport?: DeviceTransport,
) {
    const netMDDefinition = NetMDDevicesIds.find(
        entry => entry.vendorId === vendorId && entry.deviceId === productId,
    );
    const hiMDDefinition = HiMDDevicesIds.find(
        entry => entry.vendorId === vendorId && entry.deviceId === productId,
    );
    const isHiMD = Boolean(hiMDDefinition);
    const isNetMD = Boolean(netMDDefinition);
    const isSony = vendorId === 0x054c;
    const isVirtualExploitDevice = vendorId === 0x5341 && productId === 0x5256;
    if ((!isHiMD && !isNetMD) || isVirtualExploitDevice) return null;

    const modelNames = [...new Set(
        [netMDDefinition?.name, hiMDDefinition?.name].filter(Boolean),
    )];
    return {
        vendorId,
        productId,
        vendorIdHex: toHex(vendorId),
        productIdHex: toHex(productId),
        busNumber: transport?.busNumber,
        deviceAddress: transport?.deviceAddress,
        mode: isHiMD ? 'himd' : isNetMD ? 'netmd' : isSony ? 'sony-usb' : 'unknown',
        isSony,
        modelHint:
            vendorId === 0x054c && (productId === 0x0219 || productId === 0x021a)
                ? 'Sony MZ-RH10 / MZ-M100'
                : modelNames.join(' / ') || transport?.name || 'MiniDisc USB Device',
        supportsNetMD: isNetMD,
        supportsHiMD: isHiMD,
        requiredDriver: 'WinUSB',
        ...getWindowsDriverStatus(windowsDrivers, vendorId, productId),
    };
}

export function getMiniDiscDiagnostics() {
    const windowsDrivers = inspectWindowsUsbDrivers();
    let usbDevices: ReturnType<typeof usb.getDeviceList> = [];
    try {
        usbDevices = usb.getDeviceList();
    } catch (error) {
        console.warn('USB 장치 목록을 읽지 못했습니다.', error);
    }

    const libusbDevices = usbDevices
        .map(device =>
            describeMiniDiscDevice(
                device.deviceDescriptor.idVendor,
                device.deviceDescriptor.idProduct,
                windowsDrivers,
                device,
            ),
        )
        .filter(device => device !== null);

    // A fresh Windows installation can expose a USB device through PnP while
    // libusb cannot enumerate it yet because no function driver is bound.
    const knownIds = new Set(
        libusbDevices.map(device => `${device.vendorId}:${device.productId}`),
    );
    const pnpOnlyDevices = windowsDrivers
        .map(driver => {
            const identity = getWindowsUsbIdentity(driver.instanceId);
            if (!identity || knownIds.has(`${identity.vendorId}:${identity.productId}`)) {
                return null;
            }
            return describeMiniDiscDevice(
                identity.vendorId,
                identity.productId,
                windowsDrivers,
                { name: driver.name },
            );
        })
        .filter(device => device !== null);

    return {
        platform: process.platform,
        driverManagementAvailable: process.platform === 'win32',
        devices: [...libusbDevices, ...pnpOnlyDevices],
        guidance: process.platform === 'win32'
            ? [
                '지원되는 NetMD 및 Hi-MD 장치는 Windows에서 WinUSB 드라이버가 필요합니다.',
                '드라이버가 없는 새 장치도 Windows PnP 목록에서 찾아 자동 설치를 안내합니다.',
            ]
            : [
                'No vendor driver installation is required on macOS.',
                'HiMD full mode temporarily unmounts the disc and takes exclusive USB control.',
            ],
    };
}
