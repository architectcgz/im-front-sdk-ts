import MessageStatusEnum from "../common/messageStatusEnum";

export type MessageAckCallback = (conversationId: string,messageId:string,status:MessageStatusEnum,messageKey?:number) => void;