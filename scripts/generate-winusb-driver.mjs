import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { DevicesIds: netMDDevices } = require('netmd-js');
const { DevicesIds: hiMDDevices } = require('himd-js');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(
  root,
  'custom-overrides',
  'extras',
  'drivers',
  'winusb',
);
const outputPath = join(outputDirectory, 'web_minidisc_winusb.inf');

const devicesById = new Map();
for (const device of [...netMDDevices, ...hiMDDevices]) {
  // This ID is the in-app virtual exploit transport, not USB hardware.
  if (device.vendorId === 0x5341 && device.deviceId === 0x5256) continue;
  const key = `${device.vendorId}:${device.deviceId}`;
  if (!devicesById.has(key)) devicesById.set(key, device);
}

const devices = [...devicesById.values()].sort(
  (left, right) =>
    left.vendorId - right.vendorId || left.deviceId - right.deviceId,
);
const hex = value => value.toString(16).padStart(4, '0').toUpperCase();
const escapeInfString = value => String(value).replaceAll('"', "'");

const modelLines = devices.map(
  (device, index) =>
    `%DeviceName${String(index + 1).padStart(3, '0')}% = USB_Install, USB\\VID_${hex(device.vendorId)}&PID_${hex(device.deviceId)}`,
);
const nameLines = devices.map(
  (device, index) =>
    `DeviceName${String(index + 1).padStart(3, '0')} = "${escapeInfString(device.name)}"`,
);

const inf = `; Web MiniDisc Pro universal WinUSB driver
; Covers the supported physical NetMD and Hi-MD USB interfaces.

[Version]
Signature   = "$Windows NT$"
Class       = "USBDevice"
ClassGuid   = {88bae032-5a81-49f0-bc3d-a4ff138216d6}
Provider    = %ProviderName%
CatalogFile = web_minidisc_winusb.cat
DriverVer   = 08/01/2026,1.0.0.0
PnpLockdown = 1

[Manufacturer]
%ProviderName% = SupportedDevices,NTamd64

[SupportedDevices.NTamd64]
${modelLines.join('\n')}

[USB_Install]
Include = winusb.inf
Needs   = WINUSB.NT

[USB_Install.Services]
Include    = winusb.inf
AddService = WinUSB,0x00000002,WinUSB_ServiceInstall

[WinUSB_ServiceInstall]
DisplayName   = %ServiceName%
ServiceType   = 1
StartType     = 3
ErrorControl  = 1
ServiceBinary = %12%\\WinUSB.sys

[USB_Install.Wdf]
KmdfService = WINUSB, WinUsb_Install

[WinUSB_Install]
KmdfLibraryVersion = 1.11

[USB_Install.HW]
AddReg = AddDeviceInterfaceGUID

[AddDeviceInterfaceGUID]
HKR,,DeviceInterfaceGUIDs,0x10000,%DeviceInterfaceGUID%

[Strings]
ProviderName        = "Web MiniDisc Pro"
ServiceName         = "WinUSB - Web MiniDisc Pro"
DeviceInterfaceGUID = "{13CC5B23-865D-4A07-8B1B-9B43D17A3416}"
${nameLines.join('\n')}
`;

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputPath, `\uFEFF${inf.replaceAll('\n', '\r\n')}`, 'utf16le');
console.log(`Generated ${outputPath} for ${devices.length} USB IDs.`);
