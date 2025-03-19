export enum MessageCommand {
    LOGIN = 9000,
    SINGLE_MESSAGE = 1103,
    GROUP_MESSAGE = 2104,
    MESSAGE_ACK = 1046,
    MESSAGE_READ = 1106, //标记消息为已读
    MESSAGE_READ_RECEIPT = 1054,
    MESSAGE_RECEIVE_ACK = 1107,
    GROUP_MESSAGE_READ = 2106,
    GROUP_MESSAGE_READ_RECEIPT = 2054,
    USER_ONLINE_STATUS_UPDATE_NOTIFY = 4002,
    USER_ONLINE_STATUS_UPDATE_NOTIFY_SYNC = 4003,
    LOGOUT = 9003,
    HEART_BEAT = 9999,
}
export enum SystemCommand{
    LOGIN_ACK = 9001,
    MULTI_LOGIN = 9002,//多端登录下线通知
}
