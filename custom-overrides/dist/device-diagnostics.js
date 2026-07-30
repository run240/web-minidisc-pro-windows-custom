"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMiniDiscDiagnostics = getMiniDiscDiagnostics;
const usb_1 = require("usb");
const himd_js_1 = require("himd-js");
const netmd_js_1 = require("netmd-js");
const child_process_1 = require("child_process");
function matches(ids, vendorId, productId) {
    return ids.some((id) => id.vendorId === vendorId && id.deviceId === productId);
}
function toHex(value) {
    return `0x${value.toString(16).padStart(4, '0')}`;
}
function inspectWindowsUsbDrivers() {
    if (process.platform !== 'win32')
        return [];
    const command = [
        "$ErrorActionPreference = 'Stop'",
        "$devices = Get-CimInstance Win32_PnPEntity -Filter \"PNPDeviceID LIKE 'USB\\\\VID_%'\"",
        '$result = @($devices | ForEach-Object { [PSCustomObject]@{ instanceId = $_.PNPDeviceID; service = $_.Service; name = $_.Name } })',
        '$result | ConvertTo-Json -Compress',
    ].join('; ');
    try {
        const output = (0, child_process_1.execFileSync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
        if (!output)
            return [];
        const parsed = JSON.parse(output);
        return Array.isArray(parsed) ? parsed : [parsed];
    }
    catch (error) {
        console.warn('Windows USB 드라이버 상태를 읽지 못했습니다.', error);
        return [];
    }
}
function getWindowsUsbIdentity(instanceId) {
    const match = /^USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})/i.exec(instanceId);
    if (!match)
        return null;
    return {
        vendorId: Number.parseInt(match[1], 16),
        productId: Number.parseInt(match[2], 16),
    };
}
function getWindowsDriverStatus(drivers, vendorId, productId) {
    var _a;
    if (process.platform !== 'win32')
        return { driverStatus: 'not-applicable' };
    const vid = vendorId.toString(16).padStart(4, '0').toUpperCase();
    const pid = productId.toString(16).padStart(4, '0').toUpperCase();
    const driver = drivers.find((entry) => {
        const instanceId = entry.instanceId.toUpperCase();
        return instanceId.includes(`VID_${vid}&PID_${pid}`);
    });
    const driverName = (_a = driver === null || driver === void 0 ? void 0 : driver.service) === null || _a === void 0 ? void 0 : _a.trim();
    if (!driverName)
        return { driverStatus: 'unknown' };
    const normalized = driverName.toLowerCase();
    if (normalized === 'winusb')
        return { driverStatus: 'winusb', driverName };
    if (normalized === 'usbstor')
        return { driverStatus: 'usbstor', driverName };
    return { driverStatus: 'other', driverName };
}
function describeMiniDiscDevice(vendorId, productId, windowsDrivers, transport) {
    const netMDDefinition = netmd_js_1.DevicesIds.find((entry) => entry.vendorId === vendorId && entry.deviceId === productId);
    const hiMDDefinition = himd_js_1.DevicesIds.find((entry) => entry.vendorId === vendorId && entry.deviceId === productId);
    const isHiMD = Boolean(hiMDDefinition);
    const isNetMD = Boolean(netMDDefinition);
    const isSony = vendorId === 0x054c;
    const isVirtualExploitDevice = vendorId === 0x5341 && productId === 0x5256;
    if ((!isHiMD && !isNetMD) || isVirtualExploitDevice)
        return null;
    const modelNames = [...new Set([netMDDefinition === null || netMDDefinition === void 0 ? void 0 : netMDDefinition.name, hiMDDefinition === null || hiMDDefinition === void 0 ? void 0 : hiMDDefinition.name].filter(Boolean))];
    return Object.assign({ vendorId,
        productId, vendorIdHex: toHex(vendorId), productIdHex: toHex(productId), busNumber: transport === null || transport === void 0 ? void 0 : transport.busNumber, deviceAddress: transport === null || transport === void 0 ? void 0 : transport.deviceAddress, mode: isHiMD ? 'himd' : isNetMD ? 'netmd' : isSony ? 'sony-usb' : 'unknown', isSony, modelHint: vendorId === 0x054c && (productId === 0x0219 || productId === 0x021a)
            ? 'Sony MZ-RH10 / MZ-M100'
            : modelNames.join(' / ') || (transport === null || transport === void 0 ? void 0 : transport.name) || 'MiniDisc USB Device', supportsNetMD: isNetMD, supportsHiMD: isHiMD, requiredDriver: 'WinUSB' }, getWindowsDriverStatus(windowsDrivers, vendorId, productId));
}
function getMiniDiscDiagnostics() {
    const windowsDrivers = inspectWindowsUsbDrivers();
    let usbDevices = [];
    try {
        usbDevices = usb_1.usb.getDeviceList();
    }
    catch (error) {
        console.warn('USB 장치 목록을 읽지 못했습니다.', error);
    }
    const libusbDevices = usbDevices
        .map((device) => {
        const { idVendor: vendorId, idProduct: productId } = device.deviceDescriptor;
        return describeMiniDiscDevice(vendorId, productId, windowsDrivers, device);
    })
        .filter((device) => device !== null);
    const knownIds = new Set(libusbDevices.map((device) => `${device.vendorId}:${device.productId}`));
    const pnpOnlyDevices = windowsDrivers
        .map((driver) => {
        const identity = getWindowsUsbIdentity(driver.instanceId);
        if (!identity || knownIds.has(`${identity.vendorId}:${identity.productId}`))
            return null;
        return describeMiniDiscDevice(identity.vendorId, identity.productId, windowsDrivers, {
            name: driver.name,
        });
    })
        .filter((device) => device !== null);
    const devices = [...libusbDevices, ...pnpOnlyDevices];
    const guidance = process.platform === 'win32'
        ? [
            '지원되는 NetMD 및 Hi-MD 장치는 Windows에서 WinUSB 드라이버가 필요합니다.',
            'NetMD와 Hi-MD 모드가 서로 다른 장치 ID를 사용하는 기기는 각 모드에서 한 번씩 설치합니다.',
            '연결 버튼을 누르면 현재 장치와 모드에 맞는 드라이버 설치를 안내합니다.',
            'Windows 탐색기에서 디스크를 열 때만 기본 USBSTOR 드라이버로 복원하세요.',
        ]
        : [
            'No vendor driver installation is required on macOS.',
            'HiMD full mode temporarily unmounts the disc and takes exclusive USB control.',
        ];
    return {
        platform: process.platform,
        driverManagementAvailable: process.platform === 'win32',
        devices,
        guidance,
    };
}
//# sourceMappingURL=device-diagnostics.js.map
