import Logger from "../log/logger";
import { LoginPack } from '../pack/loginPack';
import { MessageCommand, SystemCommand } from '../common/command';
import { IListener } from '../interfaces/IListener';
import { MessageEncoder } from "../codec/messageEncoder";
import { MessageTypeEnum } from "../common/messageTypeEnum";
import { MessageDecoder } from "../codec/messageDecoder";
import { MessageBuilder, MessagePack } from "../pack/messagePack";
import MessageStatusEnum from "../common/messageStatusEnum";
import { MessageAckCallback } from '../callback/messageAckCallback';
import { v4 as uuid } from 'uuid';
import { IMessage} from "../interfaces/IMessage";
import { SingleMessageCallback } from "../callback/singleMessageCallback";
import { IMessageHeader } from "../interfaces/message/IMessageHeader";
import { ImTimeCalibrator } from './ImTimeCalibrator';
import { ISendMessageResult } from "../interfaces/ISendMessageResult";

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
const heartbeatInterval = 20 * TimeUnit.Second;


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
    private singleMessageCallback?: (message: IMessage) => void; 

    constructor(private imTimeCalibrator: ImTimeCalibrator){
    
    }

    public isInit():boolean{
        return this.state === State.INIT;
    }

    public async init(wsUrl: string, httpUrl: string, userId: string, token: string, appId: number,imei:string,
        messageAckCallback:MessageAckCallback,
        singleMessageCallback: SingleMessageCallback
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

    private updateMessageStatus(conversationId:string,messageId: string,status: MessageStatusEnum) {
        // 通知前端更新消息状态
        if (this.messageAckCallback) {
            this.messageAckCallback(conversationId,messageId,status);
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
            this.updateMessageStatus(pending.conversationId,messageId, MessageStatusEnum.failed);
            return;
        }
        pending.retries++;
        this._conn.send(pending.message);
        pending.timer = setTimeout(() => this.handleRetry(messageId), this.RETRY_TIMEOUT);
        this.pendingMessages.set(messageId, pending);
    }
    

    public sendMessage(messageId:string,toId:string,content:string):ISendMessageResult{
        if(!this._conn) {
            this.reconnect();
            return {
                sendTime:Number.MAX_VALUE
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
            const data = await MessageDecoder.decode(message.data);
            if (data.cmd === SystemCommand.LOGIN_ACK) {
                Logger.info("WebSocket登录成功");
            }else if(data.cmd === MessageCommand.MESSAGE_ACK){
                Logger.info("收到消息ack:",data);
                const messageId = data.body.content.messageId;
                const pending = this.pendingMessages.get(messageId);
                if (pending) {
                    pending.ackStatus.serverAck = true;
                    this.checkFinalStatus(messageId, pending);
                }
            }else if(data.cmd === MessageCommand.MESSAGE_RECEIVE_ACK){
                Logger.info("收到receiverAck: ",data); 
                const content = data.body.content;
                const messageId = content.messageId;
                const pending = this.pendingMessages.get(messageId);
                if (pending) {
                    pending.ackStatus.receiverAck = true;
                    pending.ackStatus.serverSend = content.serverSend;
                    this.checkFinalStatus(messageId, pending);
                }
            }else if(data.cmd === MessageCommand.SINGLE_MESSAGE){
                Logger.info("收到单聊消息:",data);
                //回调
                if(this.singleMessageCallback){
                    this.singleMessageCallback({
                        senderId: data.body.content.fromId,
                        key:data.body.content.messageKey,
                        id: data.body.content.messageId,
                        type: data.body.content.messageType,
                        content:data.body.content.messageBody,
                        sendTime:data.body.content.sendTime
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
                        toId: data.body.content.fromId,
                        messageKey: data.body.content.messageKey,
                        messageId: data.body.content.messageId,
                        messageSequence: data.body.content.messageSequence
                    }
                }
                Logger.info("向服务器回receiveAck: ",msgData)
                const message = MessageEncoder.encode(msgData)
                
                this._conn?.send(message)
            }
            else{
                Logger.info("收到消息:", data);
            }
        } catch (error) {
            Logger.error("消息处理失败:", error);
        }
    }


    private checkFinalStatus(messageId: string, pending: any) {
        const { serverAck, receiverAck, serverSend } = pending.ackStatus;
        
        // 最终状态判断
        if (serverAck && (receiverAck || serverSend)) {
            clearTimeout(pending.timer);
            this.pendingMessages.delete(messageId);
            this.updateMessageStatus(
                pending.conversationId, 
                messageId, 
                serverSend ? MessageStatusEnum.sent : MessageStatusEnum.delivered
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