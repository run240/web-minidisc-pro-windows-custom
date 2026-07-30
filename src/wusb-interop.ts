import { usb, WebUSB, WebUSBDevice } from "usb";
import { DevicesIds as  NetMDDevicesIds } from 'netmd-js';
import { DevicesIds as  HiMDDevicesIds } from 'himd-js';
import { DeviceIds as NWDevicesIds } from 'networkwm-js';

export class WebUSBInterop extends WebUSB {
    private preferredDevice?: {
        vendorId: number;
        productId: number;
        busNumber?: number;
        deviceAddress?: number;
    };

    setPreferredDevice(device?: {
        vendorId: number;
        productId: number;
        busNumber?: number;
        deviceAddress?: number;
    }) {
        this.preferredDevice = device
            ? {
                vendorId: device.vendorId,
                productId: device.productId,
                busNumber: device.busNumber,
                deviceAddress: device.deviceAddress,
            }
            : undefined;
    }

    clearPreferredDevice() {
        this.preferredDevice = undefined;
    }

    private findPreferredLegacyDevice() {
        const preferred = this.preferredDevice;
        if (!preferred) return undefined;
        return usb.getDeviceList().find(device => {
            const descriptor = device.deviceDescriptor;
            return descriptor.idVendor === preferred.vendorId &&
                descriptor.idProduct === preferred.productId &&
                (preferred.busNumber === undefined || device.busNumber === preferred.busNumber) &&
                (preferred.deviceAddress === undefined || device.deviceAddress === preferred.deviceAddress);
        });
    }

    private async getPreferredWebUSBDevice() {
        const legacy = this.findPreferredLegacyDevice();
        if (!legacy) throw new Error('선택한 MiniDisc USB 기기를 더 이상 찾을 수 없습니다.');
        let webUSBDevice = this.knownDevices.get(legacy);
        if (!webUSBDevice) {
            webUSBDevice = await WebUSBDevice.createInstance(legacy);
            this.addKnownDevice(legacy, webUSBDevice);
        }
        return webUSBDevice;
    }

    async requestDevice(options: USBDeviceRequestOptions) {
        const preferred = this.preferredDevice;
        if (!preferred) return super.requestDevice(options);
        const filters = options?.filters ?? [];
        if (filters.length > 0 &&
            !filters.some(filter =>
                (filter.vendorId === undefined || filter.vendorId === preferred.vendorId) &&
                (filter.productId === undefined || filter.productId === preferred.productId)
            )) {
            throw new Error('선택한 MiniDisc 기기는 요청한 연결 모드를 지원하지 않습니다.');
        }
        return this.getPreferredWebUSBDevice();
    }

    async getDevices() {
        if (!this.preferredDevice) return super.getDevices();
        try {
            return [await this.getPreferredWebUSBDevice()];
        } catch (_) {
            return [];
        }
    }

    addKnownDevice(legacy: usb.Device, webusbInstance: WebUSBDevice){
        this.knownDevices.set(legacy, webusbInstance);
    }

    static create(){
        const webusb = new WebUSBInterop({
            allowedDevices: NetMDDevicesIds.concat(HiMDDevicesIds).concat(NWDevicesIds.map(e => ({ deviceId: e.productId, ...e}))).map((n) => ({ vendorId: n.vendorId, productId: n.deviceId })),
            deviceTimeout: 10000000,
        });
        return webusb;
    }
}
