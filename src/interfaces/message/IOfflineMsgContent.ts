export interface IOfflineMsgContent{
    messageKey:number;//messageBodyId
    messageBody:any;
    sendTime:number;//客户端发送消息的时间
    delFlag: number;//0:未删除 1:已删除
    fromId:string;
    toId:string;
    messageSequence:number;
    conversationType:number;
    conversationId:string;
}