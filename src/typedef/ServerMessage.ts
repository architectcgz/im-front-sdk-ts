import { MessageCommand, SystemCommand } from "../common/command";
import { IBaseChatMsgBody } from "../interfaces/serverMessage/IBaseChatMsgBody";
import { IBaseServerMsg } from "../interfaces/serverMessage/IBaseServerMsg";
import { IChatMsgAckBody } from "../interfaces/serverMessage/IChatMsgAckBody";
import { IGroupChatMsgBody } from "../interfaces/serverMessage/IGroupChatMsgBody";
import { IMsgRcvAckBody } from "../interfaces/serverMessage/IMsgRcvAckBody";
import { ISingleMsgBody } from "../interfaces/serverMessage/ISingleChatMsgBody";
import { IUserStatusUpdateBody } from "../interfaces/serverMessage/IUserStatusUpdateBody";

export type ServerMessage = 
|IBaseServerMsg<MessageCommand.MESSAGE_ACK> & {body : IChatMsgAckBody }
|IBaseServerMsg<MessageCommand.MESSAGE_RECEIVE_ACK> & {body : IMsgRcvAckBody }
|IBaseServerMsg<SystemCommand.MULTI_LOGIN> & {body : IChatMsgAckBody }
|IBaseServerMsg<SystemCommand.LOGIN_ACK> & {body : IChatMsgAckBody }
|IBaseServerMsg<MessageCommand.SINGLE_MESSAGE> & {body: ISingleMsgBody}
|IBaseServerMsg<MessageCommand.GROUP_MESSAGE> & {body: IGroupChatMsgBody}
|IBaseServerMsg<MessageCommand.USER_ONLINE_STATUS_UPDATE_NOTIFY> & {body: IUserStatusUpdateBody}