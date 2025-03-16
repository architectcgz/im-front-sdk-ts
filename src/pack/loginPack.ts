export class LoginPack{
    appId:number;
    userId?:string;
    clientType?:number;
    constructor(appId:number,userId:string,clientType?:number){
        this.appId = appId;
        this.clientType = clientType;
        this.userId = userId;
    }
}