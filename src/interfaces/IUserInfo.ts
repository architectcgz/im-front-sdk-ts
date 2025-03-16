export interface IUserInfo {
    appId: number;
    userId: string;
    sequence: number; //用户序列号
    password?: string; // 敏感字段建议可选
    nickname: string;
    gender: number;
    birthday: string;
    location: string;
    selfSignature: string;
    avatar: string;
    disableAddFriend: number;
    silentFlag: number;
    forbiddenFlag: number;
    role: number;
    authorities: string;
    delFlag: number;
    extra: string;
    settings: any;
}
