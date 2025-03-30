import { IMHttpApi } from "./core/HttpAPI";
import { ImClient } from "./core/ImClient";
import { ImSdk } from "./core/ImSdk";
import { ImTimeCalibrator } from "./core/ImTimeCalibrator";
import { ILogoutService } from "./interfaces/ILogoutService";
import { ISdkConfig } from "./interfaces/ISdkConfig";
import { IUserInfoStorage, IUserAuthStorage} from "./interfaces/storage/IStorage";

export class ImSdkBuilder {
    private config?: ISdkConfig;
    private logoutService?: ILogoutService;
    private userInfoStorage?: IUserInfoStorage;
    private tokenStorage?: IUserAuthStorage;


    setBaseConfig(config: ISdkConfig): this {
        this.config = config;
        return this;
    }

    setLogoutService(service: ILogoutService): this {
        this.logoutService = service;
        return this;
    }

    setStorages(storages: {
        userInfo: IUserInfoStorage;
        token: IUserAuthStorage;
    }): this {
        this.userInfoStorage = storages.userInfo;
        this.tokenStorage = storages.token;
        return this;
    }

    build(): ImSdk {
        if (!this.config || !this.logoutService || !this.userInfoStorage || !this.tokenStorage ) {
            throw new Error('Missing required dependencies for SDK initialization');
        }

        const httpApi = new IMHttpApi(
            this.config.baseUrl,
            this.config.appId,
            this.config.clientType,
            this.config.deviceId,
            this.tokenStorage,
            this.userInfoStorage,
            this.logoutService
        ); 
        const imTimeCalibrator = new ImTimeCalibrator(httpApi);
        const imClient = new ImClient(imTimeCalibrator);   
        return new ImSdk(
            httpApi,
            imClient,
            imTimeCalibrator,
            this.userInfoStorage,
            this.tokenStorage,
            this.logoutService
        );
    }
}