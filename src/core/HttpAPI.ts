import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ILoginResponse } from '../interfaces/ILoginResponse';
import { IRefreshTokenResponse } from '../interfaces/IRefreshTokenResponse';
import { IUserInfo } from '../interfaces/IUserInfo';
import { IAPIResponse } from '../interfaces/IAPIResponse';
import { BaseResponse } from '../model/dto/baseResponse';
import { IUserAuthStorage, IUserInfoStorage } from '../interfaces/storage/IStorage';
import { IUserSequence } from '../interfaces/IUserSequence';
import { ILogoutService } from '../interfaces/ILogoutService';
import { IIMServerAddr } from '../interfaces/IIMServerAddr';
import { ITimeSyncResponse } from '../interfaces/ITimeSyncResponse';
import Logger from '../log/logger';
import { GetFriendListResp as FriendListResp } from '../interfaces/GetFriendListResp';
import { ISyncResponse } from '../interfaces/ISyncResponse';
import { IOfflineMsgContent } from '../interfaces/message/IOfflineMsgContent';
import { IFriendGroup } from '../interfaces/IFriendGroup';
import { IFriendStatus } from '../interfaces/IFriendStatus';
import { IFriend } from '../interfaces/IFriend';
import { ConversationTypeEnum } from '../common/ConversationTypeEnum';


let isRefreshing: boolean = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let isUserInfoLoading: boolean = false;

export class IMHttpApi {

    private axiosInstance: AxiosInstance;
    private baseUrl: string;
    private tokenStorage: IUserAuthStorage;
    private userId: string|null;
    private userInfoStorage: IUserInfoStorage
    private accessToken: string | null|undefined;
    private refreshToken: string | null|undefined;
    private logoutService : ILogoutService;

    constructor(baseUrl: string, appId: number,clientType: number, 
        deviceId: string, tokenStorage: IUserAuthStorage,userInfoStorage: IUserInfoStorage,iLogoutService: ILogoutService){
        this.baseUrl = baseUrl;
        this.tokenStorage = tokenStorage;
        this.userInfoStorage = userInfoStorage;
        this.logoutService = iLogoutService;
        this.axiosInstance = axios.create({
            baseURL: this.baseUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'X-App-ID': appId,
                'X-Client-Type': clientType,
                "X-Device-ID": deviceId
            }
        });
        this.userId = null;
        this.initialize();

        this.axiosInstance.interceptors.request.use(
            (config) => {
                const accessToken = this.accessToken;
                if (accessToken) {
                    config.headers!.Authorization = `Bearer ${accessToken}`;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
        // 响应拦截器
        this.axiosInstance.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as AxiosRequestConfig & { _isRetry?: boolean };
                
                // 处理 401 且不是刷新 Token 的请求
                if (error.response?.status === 401 && !originalRequest._isRetry) {
                    originalRequest._isRetry = true;
                    const refreshToken = this.refreshToken;
                    console.log("refreshToken in localStorage", refreshToken);
                    if (refreshToken === null) {
                        console.log("refreshToken in localStorage is null,logout");
                        this.handleLogout();
                        return Promise.reject(error);
                    }

                    if (isRefreshing) {
                        return new Promise((resolve) => {
                            refreshSubscribers.push((newToken: string) => {
                                originalRequest.headers!.Authorization = `Bearer ${newToken}`;
                                resolve(this.axiosInstance(originalRequest));
                            });
                        });
                    }

                    isRefreshing = true;

                    try {
                        console.log("刷新Token");
                        if(this.userId === null){
                            console.log("userId is null,logout");
                            this.handleLogout();
                            return Promise.reject(error);
                        }
                        // 使用原生 axios 发送刷新请求避免循环拦截
                        const refreshResponse = await axios.post<IAPIResponse<IRefreshTokenResponse>>(
                            `${this.baseUrl}/v1/auth/refresh-token`,
                            {
                                "refreshToken": refreshToken,
                                "userId": this.userId
                            },
                            {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-App-ID': appId,
                                    'X-Client-Type': clientType,
                                    "X-Device-ID": deviceId
                                }
                            }
                        );
                        
                        if(!refreshResponse.data.code){
                            console.log("刷新Token失败，logout");
                            this.handleLogout();
                            return Promise.reject(error);
                        }
                        console.log(refreshResponse);
                        this.accessToken = refreshResponse.data.data.accessToken;
                        this.refreshToken = refreshResponse.data.data.refreshToken;

                        console.log("刷新Token成功，更新token");
                        //更新token
                        await this.tokenStorage.setAccessToken(this.userId,this.accessToken);
                        await this.tokenStorage.setRefreshToken(this.userId,this.refreshToken);
                        console.log("new accessToken",this.accessToken,"new refreshToken",this.refreshToken,"")
                        this.axiosInstance.defaults.headers.Authorization = `Bearer ${this.accessToken}`;

                        // 重试所有挂起的请求
                        refreshSubscribers.forEach(cb => cb(this.accessToken!));
                        refreshSubscribers = [];
                        
                        // 重试原始请求
                        return this.axiosInstance(originalRequest);
                    } catch (refreshError) {
                        console.log("刷新Token出现错误",refreshError);
                        this.handleLogout();
                        return Promise.reject(refreshError);
                    } finally {
                        isRefreshing = false;
                    }
                }

                return Promise.reject(error);
            }
        );
    }

    private async initialize():Promise<void>{
        await this.initUserId();
        await this.initTokens();
    }
    private async initTokens() {
        Logger.info("HttpAPI获取token")
        this.accessToken = await this.tokenStorage.getAccessToken(this.userId!);
        this.refreshToken = await this.tokenStorage.getRefreshToken(this.userId!);
        console.log("accessToken in storage: ",this.accessToken,"refreshToken in storage: ",this.refreshToken);
        // 如果 accessToken 和 refreshToken 不为空，设置到请求头中
        if (this.accessToken) {
            this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
        }
        if (this.refreshToken) {
            this.axiosInstance.defaults.headers.common['X-Refresh-Token'] = this.refreshToken;
        }
    }

    private async initUserId() {
        if (isUserInfoLoading) return; // 避免重复调用
        isUserInfoLoading = true;
        try {
            //由storage中保存的currentUser获取当前用户信息
            const userInfo = await this.userInfoStorage.getUserInfo();
            Logger.info("HttpAPI从本地获取用户信息")
            if (userInfo?.userId) {
                this.userId = userInfo.userId;
                Logger.info("成功从本地获取到用户id:", this.userId);
            } else {
                Logger.error("从本地获取用户id失败");
                this.userId = null;
            }
        } catch (error) {
            this.userId = null;
            console.error("从本地获取用户id失败:", error);
            this.logoutService.logout();
        } finally {
            isUserInfoLoading = false;
        }
    }

    private handleLogout(): void {
       this.logoutService.logout();
    }

    async login(userId: string, password: string): Promise<BaseResponse<ILoginResponse>> {
        this.userId = userId;
        console.log("登录时的userId: ",userId);
        const response = await this.axiosInstance.post<IAPIResponse<ILoginResponse>>('/v1/auth/login', { userId, password });
        // 登录成功保存 Token
        this.accessToken = response.data.data.accessToken;
        this.refreshToken = response.data.data.refreshToken;
        this.tokenStorage.setTokens(userId, this.accessToken, this.refreshToken);
        Logger.info(`登录成功,保存token, accessToken: ${this.accessToken}, refreshToken: ${this.refreshToken}`);
        return new BaseResponse<ILoginResponse>(response.data.code, response.data.message, response.data.data);
    }
    /**
     * 获取用户信息
     * @returns 用户信息
     */
    async getUserInfo(): Promise<BaseResponse<IUserInfo>> {
        const response = await this.axiosInstance.get<IAPIResponse<IUserInfo>>('/v1/user/info');
        return new BaseResponse<IUserInfo>(response.data.code, response.data.message, response.data.data);
    }
    /**
     * 用户登录后或者在主页面获取IM Server地址用于连接到im server
     * @returns IM Server 地址
     */
    async getIMServerAddress():Promise<BaseResponse<IIMServerAddr>>{
        const response = await this.axiosInstance.get<IAPIResponse<IIMServerAddr>>('/v1/user/im-server-address');
        console.log("IMServerAddress: ",response.data.data)
        return new BaseResponse<IIMServerAddr>(response.data.code, response.data.message, response.data.data);
    }

    async testToken(): Promise<BaseResponse<any>> {
        const response = await this.axiosInstance.post<IAPIResponse<void>>('/v1/auth/test-token');
        return new BaseResponse<any>(response.data.code, response.data.message, response.data.data);
    }

    async getUserSequence():Promise<BaseResponse<IUserSequence>>{
        const response = await this.axiosInstance.get<IAPIResponse<IUserSequence>>('/v1/user/sequence');
        return new BaseResponse<IUserSequence>(response.data.code, response.data.message, response.data.data);
    }

    async syncTime():Promise<BaseResponse<ITimeSyncResponse>>{
        const response = await this.axiosInstance.get<IAPIResponse<ITimeSyncResponse>>('/v1/time/sync',{
            timeout: 1500 // 单独设置超时
        });
        return new BaseResponse<ITimeSyncResponse>(response.data.code,response.data.message, response.data.data);
    }

    async getFriendInfo():Promise<BaseResponse<IFriend>>{
        const response = await this.axiosInstance.get<IAPIResponse<IFriend>>('/v1/friend/info');
        return new BaseResponse<IFriend>(response.data.code,response.data.message, response.data.data);
    }

    async getFriendList(cursor?:number,limit?:number):Promise<BaseResponse<FriendListResp>> {
        const response = await this.axiosInstance.get<IAPIResponse<FriendListResp>>("/v1/friend/list",{
            params:{
                cursor: cursor,
                limit: limit
            }
        });
        return new BaseResponse<FriendListResp>(response.data.code,response.data.message, response.data.data);
    }

    async syncOfflineMessage():Promise<BaseResponse<ISyncResponse<IOfflineMsgContent>>>{
        const response = await this.axiosInstance.get<IAPIResponse<ISyncResponse<IOfflineMsgContent>>>('/v1/message/offline-sync');
        return new BaseResponse<ISyncResponse<IOfflineMsgContent>>(response.data.code,response.data.message, response.data.data);
    }

    async syncConversationList(lastSequence:number,limit: number): Promise<BaseResponse<ISyncResponse<IConversation>>>{
        const response = await this.axiosInstance.post<IAPIResponse<ISyncResponse<IConversation>>>('/v1/conversation/list/sync',{
            lastSequence: lastSequence,
            limit: limit
        });
        return new BaseResponse<ISyncResponse<IConversation>>(response.data.code,response.data.message, response.data.data);
    }

    async getFriendGroupSequence():Promise<BaseResponse<number>>{
        const response = await this.axiosInstance.get<IAPIResponse<number>>("/v1/friend/group/sequence");
        return new BaseResponse(response.data.code,response.data.message,response.data.data);
    }

    async getFriendGroupListWithId(){
        const response = await this.axiosInstance.get<IAPIResponse<IFriendGroup[]>>("/v1/friend/group/list-with-friend-id");
        return new BaseResponse(response.data.code,response.data.message,response.data.data);
    }
    async getFriendOnlineStatus() {
        const response = await this.axiosInstance.get<IAPIResponse<IFriendStatus[]>>("/v1/friend/online-status");
        return new BaseResponse<IFriendStatus[]>(response.data.code,response.data.message,response.data.data);
    }

    async createConversation(toId:string,type:ConversationTypeEnum){
        const response = await this.axiosInstance.post<IAPIResponse<string>>("/v1/conversation/create",{
            toId:toId,
            type:type
        });
        return new BaseResponse<string>(response.data.code,response.data.message,response.data.data)
    }

    async updateConversation(toId:string,isMute?:number,isTop?:number):Promise<BaseResponse<number>>{
        const response = await this.axiosInstance.post<IAPIResponse<number>>('/v1/conversation/update',{
            fromId: this.userId,
            toId: toId,
            isTop: isTop,
            isMute: isMute
        });
        return new BaseResponse<number>(response.data.code,response.data.message,response.data.data);
    }

}
