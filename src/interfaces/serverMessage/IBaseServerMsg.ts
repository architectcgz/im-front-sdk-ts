export interface IBaseServerMsg<T extends number> {
    cmd: T,
    body: Record<string,unknown>;
}