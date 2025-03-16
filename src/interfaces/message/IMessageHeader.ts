export interface IMessageHeader{
    appId: number;
    cmd: number;
    version: string,
    clientType: number
    imei: string
    messageType: number
}