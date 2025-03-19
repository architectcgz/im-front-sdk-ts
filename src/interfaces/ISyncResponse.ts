export interface ISyncResponse<T>{
    maxSequence:number,
    completed: boolean,
    data: T[]
}