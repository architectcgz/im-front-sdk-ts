interface DeviceInfo {
    system: string;
    platform: string;
    brand?: string;
    model?: string;
}

export class WebToolkit {
    static getDeviceInfo(): DeviceInfo {
        // Web 环境
        if (typeof window !== 'undefined') {
            const userAgent = window.navigator.userAgent;
            return {
                system: this.generateWebImei(),
                platform: 'Web',
                brand: 'Browser',
                model: userAgent
            };
        }
        
        // UniApp 环境
        // @ts-ignore
        if (typeof uni !== 'undefined') {
            // @ts-ignore
            const systemInfo = uni.getSystemInfoSync();
            return {
                system: systemInfo.deviceId || this.generateUniAppImei(),
                platform: systemInfo.platform,
                brand: systemInfo.brand,
                model: systemInfo.model
            };
        }
        
        // 微信小程序环境
        // @ts-ignore
        if (typeof wx !== 'undefined') {
            // @ts-ignore
            const systemInfo = wx.getSystemInfoSync();
            return {
                system: this.generateWxAppImei(),
                platform: systemInfo.platform,
                brand: systemInfo.brand,
                model: systemInfo.model
            };
        }

        return {
            system: this.generateDefaultImei(),
            platform: 'Unknown',
        };
    }

    private static generateWebImei(): string {
        const timestamp = new Date().getTime().toString();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `WEB${timestamp}${random}`;
    }

    private static generateUniAppImei(): string {
        const timestamp = new Date().getTime().toString();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `UNI${timestamp}${random}`;
    }

    private static generateWxAppImei(): string {
        const timestamp = new Date().getTime().toString();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `WX${timestamp}${random}`;
    }

    private static generateDefaultImei(): string {
        const timestamp = new Date().getTime().toString();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
        return `DEF${timestamp}${random}`;
    }
} 