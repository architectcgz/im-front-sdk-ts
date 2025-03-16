import Logger from "../log/logger";
import { IMHttpApi } from "./HttpAPI";

export class ImTimeCalibrator {
    private offset: number = 0; // 本地时间与服务器的时间差（本地时间 + offset ≈ 服务器时间）
    private lastSync: number = 0; // 最后一次同步时间戳
    private syncTimer: NodeJS.Timeout | null = null;   // 定时器ID
    private syncInterval: number;                     // 同步间隔（毫秒）

    //通过构造函数注入httpAPI实例
    constructor(private httpApi: IMHttpApi,syncInterval: number = 60_000) {
        this.syncInterval = syncInterval;
        this.startAutoSync();                           // 创建实例后自动启动定时器
    }
    /** 启动自动同步 */
    startAutoSync(): void {
        if (this.syncTimer) return;                     // 避免重复启动
        this.syncTimer = setInterval(() => {
        this.syncTime()
            .catch(err => console.error('自动同步失败:', err)); // 静默处理错误
        }, this.syncInterval);
    }
      /** 停止自动同步 */
    stopAutoSync(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    // 发起时间同步请求
    async syncTime():Promise<void> {
        //使用高精度时间
        const t1 = Date.now();
        try {
            const response = await this.httpApi.syncTime();
            Logger.info("时间同步响应: ", response.data)
            const { t2, t3 } = response.data;
            const t4 = Date.now();
            // 计算网络延迟补偿
            const rtt = t4 - t1; // 网络往返时延
            Logger.info("网络往返时延:", rtt);
            const processingTime = t3 - t2;// 服务端处理时间
            Logger.info("服务端处理时间:", processingTime);     
            const oneWayDelay = Math.max(0,(rtt - processingTime)/2);
            //更新时间偏移量
            this.offset = t2 - t1 + oneWayDelay;
            this.lastSync = Date.now();

        } catch (error) {
            console.error('时间同步失败:', error);
            // 触发降级策略（如使用最后一次有效值）
        }
    }
    
    // 获取校准时间（带降级策略）
    get now(): number {
    // 降级策略：超过2分钟未同步使用原生时间
    return Date.now() - this.lastSync > 120_000 
        ? Date.now() 
        : Date.now() + this.offset;
    }

    destroy(): void {
        this.stopAutoSync();
    }
}
