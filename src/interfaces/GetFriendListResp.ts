import { IFriend } from "./IFriend";

export interface GetFriendListResp{
    completed: boolean;
    friendList: IFriend[];
    cursor: number;
}