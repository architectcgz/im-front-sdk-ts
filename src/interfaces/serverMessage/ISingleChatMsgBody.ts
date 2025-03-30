import { IBaseChatMsgBody } from "./IBaseChatMsgBody";

export interface ISingleMsgBody extends IBaseChatMsgBody{
    toId:string
}