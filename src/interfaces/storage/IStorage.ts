import { IUserInfo } from '../IUserInfo';

export interface IUserAuthStorage {
    setTokens(userId:string,token: string,refreshToken: string,): Promise<void>;
    getAccessToken(userId:string): Promise<string | null>;
    setAccessToken(userId:string,token: string): Promise<void>;
    getRefreshToken(userId:string,): Promise<string | null>;
    setRefreshToken(userId:string,token: string): Promise<void>;
    clearTokens(userId:string,): Promise<void>;
}

export interface IUserInfoStorage{
  getUserInfo(): Promise<IUserInfo|null>;
  setUserInfo(userInfo:IUserInfo): Promise<void>;
  clearUserInfo(userId:string): Promise<void>;
}


