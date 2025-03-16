interface IConversation {
    id: string //会话id
    name: string //群或对方名称
    sender: string //消息发送者名称
    avatar: string //对方头像
    lastMessage: string//最后一条消息
    lastMessageTime: number//最后发消息的时间戳
    unreadCount: number//未读消息条数
    chatType: number//会话类型
    isTop:boolean
    isMute: boolean
}
