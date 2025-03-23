import { IFriendStatusChange } from "../interfaces/IFriendStatusChange";

export type FriendStatusChangeCallback = (friendId:string,friendStatus:IFriendStatusChange) => void;