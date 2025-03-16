export class DeviceUtil {
    static getDeviceInfo(): { imei: string } {
        // 获取浏览器信息
        const userAgent = navigator.userAgent;
        // 获取语言
        const language = navigator.language;
        // 获取时区
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        // 获取CPU核心数
        const hardwareConcurrency = navigator.hardwareConcurrency || 'unknown';
        // 获取设备内存
        const deviceMemory = (navigator as any).deviceMemory || 'unknown';

        // 将这些信息组合成一个字符串
        const deviceInfo = `${userAgent}|${language}|${timezone}|${hardwareConcurrency}|${deviceMemory}`;

        // 生成imei
        return {
            imei: this.hashCode(deviceInfo)
        };
    }

    private static hashCode(str: string): string {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString();
    }
} 