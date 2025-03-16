import { MessageTypeEnum } from "../../common/messageTypeEnum";

export interface IMessageContent {
  type: MessageTypeEnum;
  fromId: string;
  toId: string;
  data: any;
}