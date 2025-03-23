export interface IFriendStatus{
    friendId:string,
    status: {
        status:number;//表示这个用户是否至少有一端在线
        clientsStatusMap:{};//各个客户端的状态 clientType:status
    },
    customText:string
}