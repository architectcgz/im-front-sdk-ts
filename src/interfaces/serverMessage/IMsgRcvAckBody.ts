export interface IMsgRcvAckBody{
    messageKey:number,
    fromId:string,
    toId:string,
    messageId:string,
    sequence:number,
    serverSend:boolean
}