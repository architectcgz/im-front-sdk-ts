export interface IFriendStatusChange{
    appId:number;//应用id
    id:string;//好友的id
    status:{
        status:number;//表示这个用户是否至少有一端在线
        clientsStatusMap:Map<number,number>;//各个客户端的状态 clientType:status
    }
}