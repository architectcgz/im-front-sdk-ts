import { ILogoutService } from "../interfaces/ILogoutService";
import { IUserAuthStorage, IUserInfoStorage} from "../interfaces/storage/IStorage";
import { IMHttpApi } from "./HttpAPI";
import { ImClient } from "./ImClient";
import { ImTimeCalibrator } from "./ImTimeCalibrator";


export class ImSdk {
  constructor(
    public readonly httpApi: IMHttpApi,
    public readonly imClient: ImClient,
    public readonly timeCalibrator: ImTimeCalibrator,
    public readonly userInfoStorage: IUserInfoStorage,
    public readonly tokenStorage: IUserAuthStorage,
    public readonly logoutService: ILogoutService,
  ) {}
}