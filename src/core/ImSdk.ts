import { ILogoutService } from "../interfaces/ILogoutService";
import { ITokenStorage, IUserInfoStorage, ISequenceStorage } from "../interfaces/IStorage";
import { IMHttpApi } from "./HttpAPI";
import { ImClient } from "./ImClient";
import { ImTimeCalibrator } from "./ImTimeCalibrator";


export class ImSdk {
  constructor(
    public readonly httpApi: IMHttpApi,
    public readonly imClient: ImClient,
    public readonly timeCalibrator: ImTimeCalibrator,
    public readonly userInfoStorage: IUserInfoStorage,
    public readonly tokenStorage: ITokenStorage,
    public readonly userSequenceStorage: ISequenceStorage,
    public readonly logoutService: ILogoutService,
  ) {}
}