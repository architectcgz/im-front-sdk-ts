import { MessageTypeEnum } from '../common/messageTypeEnum';
import { IMessageHeader } from '../interfaces/message/IMessageHeader';
import { IMessageContent } from '../interfaces/message/IMessageContent';
export class MessagePack {
  public readonly messageId?: string;
  public readonly messageTime?: number;
  public readonly messageRandom?: number;

  constructor(
    public header?: IMessageHeader,
    public content?: IMessageContent,
    options?: {
      messageId?: string;
      messageTime?: number;
      messageRandom?: number;
    }
  ) {
    this.messageId = options?.messageId;
    this.messageTime = options?.messageTime;
    this.messageRandom = options?.messageRandom;
  }

  // 通用消息构建方法
  static create(
    header: IMessageHeader,
    content: IMessageContent
  ): MessagePack {
    return new MessagePack(header, content);
  }
  // 空内容消息（适用于心跳等场景）
  static empty() {
    return new MessagePack();
  }

  // 获取完整的消息包JSON
  toJSON() {
    return {
      ...this.header,
      messageBody: this.content
    };
  }

  // 获取序列化的消息体
  get messageBody(): string {
    return JSON.stringify(this.content);
  }
}

// 消息构建辅助函数
export const MessageBuilder = {
  text: (fromId: string, toId: string, text: string): IMessageContent => ({
    type: MessageTypeEnum.text,
    fromId,
    toId,
    data: { content: text }
  }),

  image: (fromId: string, toId: string, imageObj: {
    original: string;
    thumb: string;
  }): IMessageContent => ({
    type: MessageTypeEnum.image,
    fromId,
    toId,
    data: {
      original: imageObj.original,
      thumb: imageObj.thumb
    }
  }),

  video: (fromId: string, toId: string, videoObj: {
    original: string;
    thumb: string;
    duration: number;
    size: number;
    format: string;
  }): IMessageContent => ({
    type: MessageTypeEnum.video,
    fromId,
    toId,
    data: videoObj
  }),

  custom: <T>(fromId: string, toId: string, type: MessageTypeEnum, data: T): IMessageContent => ({
    type,
    fromId,
    toId,
    data
  })
};