import { IBaseChatMsgBody } from "./IBaseChatMsgBody";

export interface IGroupChatMsgBody extends IBaseChatMsgBody{
    groupId:string
}