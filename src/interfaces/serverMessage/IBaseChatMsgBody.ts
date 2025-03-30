export interface IBaseChatMsgBody {
    fromId: string;
    content: string;
    messageId: string;
    sendTime: number;
    messageKey: number;
    messageSequence: number;
    conversationId: string;
    messageType: number;
}