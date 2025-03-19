interface IConversation {
    id: string //会话id
    name: string //会话名称,由用户定义
    type: number//会话类型
    fromId: string// 会话发起者id
    toId: string // 会话接收者id
    isTop:boolean
    isMute: boolean
    sequence: number// 会话序列
    readSequence: number// 用户已读到的序列号
}
