// src/Application/Utils/Device.ts

class Device {
    isMobile(): boolean {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        return /android|ipad|iphone|ipod|windows phone/i.test(userAgent);
    }
}

export default new Device();
