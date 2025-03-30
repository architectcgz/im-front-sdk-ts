export interface UserClientStatus{
    status:number,//用户在线状态,一端在线即在线，设置为1
    clientsStatusMap:Map<number,number>//用户各个客户端的在线状态clientType:status
}
export interface IUserStatusUpdateBody {
    userId:string,
    userClientsStatus:UserClientStatus
}