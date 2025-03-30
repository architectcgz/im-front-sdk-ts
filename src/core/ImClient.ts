import Logger from "../log/logger";
import { LoginPack } from '../pack/loginPack';
import { MessageCommand, SystemCommand } from '../common/command';
import { IListener } from '../interfaces/IListener';
import { MessageEncoder } from "../codec/messageEncoder";
import { MessageTypeEnum } from "../common/messageTypeEnum";
import { MessageDecoder } from "../codec/messageDecoder";
import MessageStatusEnum from "../common/messageStatusEnum";
import { MessageAckCallback } from '../callback/messageAckCallback';
import { v4 as uuid } from 'uuid';
import { IMessage} from "../interfaces/IMessage";
import { SingleMessageCallback } from "../callback/singleMessageCallback";
import { ImTimeCalibrator } from './ImTimeCalibrator';
import { ISendMessageResult } from "../interfaces/ISendMessageResult";
import { FriendStatusChangeCallback } from "../callback/FriendStatusChangeCallback";
import { IFriendStatusChange } from "../interfaces/IFriendStatusChange";
import { ServerMessage } from "../typedef/ServerMessage";

export enum State{
    INIT,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
    DISCONNECTING,
    DISCONNECTED,
}

export enum TimeUnit{
    Second = 1000,
    Millisecond = 1,
}
const loginTimeout = 10 * TimeUnit.Second;
const heartbeatInterval = 50 * TimeUnit.Second;


export class ImClient{
    public wsUrl: string = "";
    public userId!: string;
    public version: string = "1.0.0";
    public clientType: number = 1;
    public imei!: string;
    public listeners: IListener = {};
    public appId!: number;
    public token!: string;
    public imeiLen?: number;
    public state = State.INIT;
    public httpUrl: string = "";
    private _conn?: WebSocket;
    private _heartbeatTimer?: number;
    private pendingMessages = new Map<string, {
        message: any;
        conversationId:string;
        retries: number;
        timer: NodeJS.Timeout;
        ackStatus:{
            serverAck: boolean,
            receiverAck: boolean,
            serverSend: boolean
        } 
    }>();
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_TIMEOUT = 5000;

    private messageAckCallback?:MessageAckCallback;//信息确认回调
    private singleMessageCallback?: SingleMessageCallback;//单聊消息回调 
    private friendStatusChangeCallback?:FriendStatusChangeCallback;//好友状态改变回调

    constructor(private imTimeCalibrator: ImTimeCalibrator){
    
    }
    destroy() {
        // 关闭 WebSocket 连接
        if (this._conn) {
            this._conn.close();
            this._conn = undefined;
            console.log("WebSocket closed");
        }
    
        // 清除心跳定时器
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = undefined;
            console.log("Heartbeat timer cleared");
        }
    }

    public isInit():boolean{
        return this.state === State.INIT;
    }

    public async init(wsUrl: string, httpUrl: string, userId: string, token: string, appId: number,imei:string,
        messageAckCallback:MessageAckCallback,
        singleMessageCallback: SingleMessageCallback,
        friendStatusChangeCallback:FriendStatusChangeCallback
    ) {
        this.wsUrl = wsUrl;
        this.httpUrl = httpUrl;
        this.userId = userId;
        this.token = token;
        this.appId = appId;
        this.imei = imei;
        this.imeiLen = this.imei.length;
        this.messageAckCallback = messageAckCallback;
        this.singleMessageCallback = singleMessageCallback;
        this.friendStatusChangeCallback = friendStatusChangeCallback;
        await this.connectWebSocket();
    }

    private async connectWebSocket() {
        while (this.state !== State.CONNECTED) {
            try {
                const req = new LoginPack(this.appId, this.userId, this.clientType);
                const { success, conn } = await imLogin(req, this);
                
                if (success) {
                    this._conn = conn;
                    this.state = State.CONNECTED;
                    this.setupWebSocketListeners();
                    this.startHeartbeat();
                    break;
                }
            } catch (error) {
                Logger.error("WebSocket连接失败:", error);
                await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒后重试
            }
        }
    }

    private setupWebSocketListeners() {
        if (!this._conn) return;

        this._conn.onerror = (error) => {
            Logger.error("WebSocket error:", error);
            this.state = State.DISCONNECTED;
            this.reconnect();
        };

        this._conn.onclose = () => {
            Logger.info("WebSocket closed");
            this.state = State.DISCONNECTED;
            this.reconnect();
        };

        this._conn.onmessage = (message) => {
            this.handleMessage(message);
        };
    }

    private async reconnect() {
        if (this.state === State.RECONNECTING) return;
        this.state = State.RECONNECTING;
        await this.connectWebSocket();
    }

    private startHeartbeat() {
        this._heartbeatTimer = setInterval(() => {
            if (this._conn?.readyState === WebSocket.OPEN) {
                Logger.info("send heartbeat,imei:"+this.imei);
                const message = MessageEncoder.encode({
                    cmd: MessageCommand.HEART_BEAT,
                    version: this.version,
                    clientType: this.clientType,
                    messageType: MessageTypeEnum.text,
                    appId: this.appId,
                    imei: this.imei,
                    messageBody: null
                });
                this._conn.send(message);
            }
        }, heartbeatInterval) as unknown as number;
    }

    public generateMessageId() {
        return uuid();
    }

    private updateMessage(conversationId:string,
        messageId: string,
        status: MessageStatusEnum,
        messageKey?:number,
        messageSequence?:number,
        errorMsg?:string
    ) {
        // 通知前端更新消息状态以及消息key
        if (this.messageAckCallback) {
            this.messageAckCallback(conversationId,messageId,status,messageKey,messageSequence);
        }
    }

    private handleRetry(messageId: string) {
        if(!this._conn) {
            this.reconnect();
            return;
        }
        const pending = this.pendingMessages.get(messageId);
        if (!pending) return;
        //消息重试次数大于最大次数,标记为消息发送失败
        if (pending.retries >= this.MAX_RETRIES) {
            this.pendingMessages.delete(messageId);
            this.updateMessage(pending.conversationId,messageId, MessageStatusEnum.failed,undefined,undefined);
            return;
        }
        pending.retries++;
        this._conn.send(pending.message);
        pending.timer = setTimeout(() => this.handleRetry(messageId), this.RETRY_TIMEOUT);
        this.pendingMessages.set(messageId, pending);
    }
    

    public sendMessage(messageId:string,toId:string,content:string,type:MessageTypeEnum):ISendMessageResult{
        if(!this._conn) {
            this.reconnect();
            return {
                sendTime:Number.MAX_VALUE,
            };
        }
        const sendTime = this.imTimeCalibrator.now;
        const msgData = {
            cmd: MessageCommand.SINGLE_MESSAGE,
            version: this.version,
            clientType: this.clientType,
            messageType: MessageTypeEnum.text,
            appId: this.appId,
            imei: this.imei,
            messageBody: {
                messageType: type,
                fromId: this.userId,
                toId: toId,
                messageId: messageId,
                content: content,
                sendTime: this.imTimeCalibrator.now
            }
        };
        Logger.info("要发送的消息: ",msgData)
        const message = MessageEncoder.encode(msgData)

        // 初始化ACK状态
        this.pendingMessages.set(messageId, {
            message,
            conversationId: toId,
            retries: 0,
            timer: setTimeout(() => this.handleAckTimeout(messageId), 15000), // 15秒超时
            ackStatus: {
                serverAck: false,
                receiverAck: false,
                serverSend: false
            }
        });

        this._conn.send(message);
        return {
            sent: true,
            sendTime
        } as ISendMessageResult;
    }

    public async markMessageRead(lastSeq:number,toId:string,convType:number) {
        if(!this._conn){
            this.reconnect();
            return;
        }
        Logger.info(`标记消息已读, lastSeq:${lastSeq},toId: ${toId} convType: ${convType}`);
        const msgData = {
            cmd: MessageCommand.MESSAGE_READ,
            version: this.version,
            clientType: this.clientType,
            messageType: MessageTypeEnum.text,
            appId: this.appId,
            imei: this.imei,
            messageBody: {
                fromId: this.userId,
                toId: toId,
                lastSequence: lastSeq,
                conversationType: convType
            }
        };
        const message = MessageEncoder.encode(msgData)
        this._conn.send(message);
    }

    // 新增ACK超时处理
    private handleAckTimeout(messageId: string) {
        const pending = this.pendingMessages.get(messageId);
        if (!pending) return;

        // 如果服务器没有ACK或接收方没有ACK（且不是服务器代发）
        if (!pending.ackStatus.serverAck || 
            (!pending.ackStatus.receiverAck && !pending.ackStatus.serverSend)) {
            this.handleRetry(messageId);
        }
    }

    private async handleMessage(message: MessageEvent) {
        try {
            const data = await MessageDecoder.decode(message.data) as ServerMessage;
            Logger.info("收到消息:", data);
            if (data.cmd === SystemCommand.LOGIN_ACK) {
                Logger.info("WebSocket登录成功");
            }else if(data.cmd === MessageCommand.MESSAGE_ACK){
                Logger.info("收到服务器消息ack:",data);
                const body = data.body;
                const messageId = body.messageId;
                const pending = this.pendingMessages.get(messageId);
                const messageKey = body.messageKey;
                const messageSequence = body.messageSequence;
                if(body.success){
                    if (pending) {
                        pending.ackStatus.serverAck = true;
                        this.checkFinalStatus(messageId, pending,messageKey,messageSequence);
                    }
                }else{
                    //消息发送失败情况
                    if(pending){
                        const errorMsg = body.errorMsg|| "消息发送失败";
                        clearTimeout(pending.timer);
                        this.pendingMessages.delete(messageId);
                        this.updateMessage(
                            pending.conversationId,messageId,
                            MessageStatusEnum.failed,
                            messageKey,
                            messageSequence,
                            errorMsg
                        );
                    }
                }

            }else if(data.cmd === MessageCommand.MESSAGE_RECEIVE_ACK){
                Logger.info("收到receiveAck: ",data); 
                const content = data.body;
                const messageId = content.messageId;
                const messageKey = content.messageKey;
                const messageSequence = content.sequence;
                const pending = this.pendingMessages.get(messageId);
                if (pending) {
                    pending.ackStatus.receiverAck = true;
                    pending.ackStatus.serverSend = content.serverSend;
                    this.checkFinalStatus(messageId, pending,messageKey,messageSequence);
                }
            }else if(data.cmd === MessageCommand.SINGLE_MESSAGE){
                Logger.info("收到单聊消息:",data);
                //回调
                if(this.singleMessageCallback){
                    this.singleMessageCallback({
                        senderId: data.body.fromId,
                        key:data.body.messageKey,
                        id: data.body.messageId,
                        type: data.body.messageType,
                        content:data.body.messageBody,
                        sendTime:data.body.sendTime,
                        sequence:data.body.messageSequence,
                    }as IMessage);
                }
                //向服务器回ack
                const msgData = {
                    cmd: MessageCommand.MESSAGE_RECEIVE_ACK,
                    version: this.version,
                    clientType: this.clientType,
                    messageType: MessageTypeEnum.text,
                    appId: this.appId,
                    imei: this.imei,
                    messageBody: {
                        fromId: this.userId, 
                        toId: data.body.fromId,
                        messageKey: data.body.messageKey,
                        messageId: data.body.messageId,
                        messageSequence: data.body.messageSequence,
                        toImei:data.body.imei,//ack接收方的imei
                        toClientType: data.body.clientType,//ack接收方的clientType
                    }
                }
                Logger.info("向服务器回receiveAck: ",msgData)
                const message = MessageEncoder.encode(msgData)
                
                this._conn?.send(message)
            }else if(data.cmd === MessageCommand.USER_ONLINE_STATUS_UPDATE_NOTIFY){
                //在线状态变化的好友id
                const body = data.body;
                console.log("收到好友在线状态变更通知,",data,"消息体:",body)
                const friendId = data.body.userId;
                //回调,通知好友列表变更状态
                if(this.friendStatusChangeCallback){
                    this.friendStatusChangeCallback(friendId,{
                        appId: body.appId,
                        id:body.userId,
                        status: body.userClientsStatus,
                    }as IFriendStatusChange);
                }
            }
            else{
                Logger.info("暂时不能处理此种消息")
            }
        } catch (error) {
            Logger.error("消息处理失败:", error);
        }
    }


    private checkFinalStatus(
        messageId: string,
        pending: any,
        messageKey?:number,
        messageSequence?:number,
        errorMsg?:string
    ) {
        const { serverAck, receiverAck, serverSend } = pending.ackStatus;
        // 最终状态判断
        if (serverAck && (receiverAck || serverSend)) {
            clearTimeout(pending.timer);
            this.pendingMessages.delete(messageId);
            this.updateMessage(
                pending.conversationId, 
                messageId, 
                serverSend ? MessageStatusEnum.sent : MessageStatusEnum.delivered,
                messageKey,
                messageSequence
            );
        }
    }
}

export let imLogin = async (req: LoginPack, imClient: ImClient): Promise<{ success: boolean, error?: Error, conn: WebSocket }> => {
    return new Promise((resolve, _) => {
        let conn = new WebSocket(imClient.wsUrl);
        Logger.info("正在连接websocket...,wsUrl:"+imClient.wsUrl);
        
        let loginTimer = setTimeout(() => {
            clearTimeout(loginTimer);
            resolve({ success: false, error: new Error("登录超时"), conn: conn });
        }, loginTimeout);
        
        conn.onopen = () => {
            if (conn.readyState === WebSocket.OPEN) {
                //ws连接上后发送Login请求 
                Logger.info("cmd :"+MessageCommand.LOGIN
                    +",version:"+imClient.version
                    +",clientType:"+imClient.clientType
                    +",messageType:"+MessageTypeEnum.text
                    +",appId:"+imClient.appId
                    +",imei:"+imClient.imei
                    +",fromId:"+req.userId
                    +",messageBody:"
                    +JSON.stringify({ userId: imClient.userId }));
                const message = MessageEncoder.encode({
                    cmd: MessageCommand.LOGIN,
                    version: imClient.version,
                    clientType: imClient.clientType,
                    messageType: MessageTypeEnum.text,
                    appId: imClient.appId,
                    imei: imClient.imei,
                    messageBody: { userId: imClient.userId }
                });
                conn.send(message);
                
            }
        };
        
        conn.onerror = (error) => {
            clearTimeout(loginTimer);
            Logger.error("WebSocket error:", error);
            resolve({ success: false, error: new Error("登录失败"), conn: conn });
        };
        
        conn.onmessage = async (message) => {
            if (typeof message.data === "string") return;
            
            clearTimeout(loginTimer);
            let data = await MessageDecoder.decode(message.data);
            if (data.cmd === SystemCommand.LOGIN_ACK) {
                resolve({ success: true, conn: conn });
            }
        };
    });
};