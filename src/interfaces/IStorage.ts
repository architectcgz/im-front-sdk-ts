import { IUserInfo } from './IUserInfo';
import { IUserSequence } from './IUserSequence';

export interface ITokenStorage {
    setTokens(userId:string,token: string,refreshToken: string,): Promise<void>;
    getAccessToken(userId:string): Promise<string | null>;
    setAccessToken(userId:string,token: string): Promise<void>;
    getRefreshToken(userId:string,): Promise<string | null>;
    setRefreshToken(userId:string,token: string): Promise<void>;
    clearTokens(userId:string,): Promise<void>;
}

export interface IUserInfoStorage{
  getUserInfo(): Promise<IUserInfo|null>;
  setUserInfo(userId:string,IUserInfo:IUserInfo): Promise<void>;
  clearUserInfo(userId:string,): Promise<void>;
}

export interface ISequenceStorage {
    getUserSequence(userId:string,): Promise<IUserSequence|null>;
    setUserSequence(userId:string,IUserSequence:IUserSequence): Promise<void>;
    clearUserSequence(userId:string,): Promise<void>;
}



