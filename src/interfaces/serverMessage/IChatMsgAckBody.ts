export interface IChatMsgAckBody {
    messageId: string;
    messageKey?: number;
    serverSend: boolean,
    success: boolean;
    errorMsg?: string;
    messageSequence?: number;
}