export class BaseResponse<T> {
    public code!: number;
    public message!: string;
    public data!: T;
   constructor(code:number,message: string,data: T) {
        this.code = code;
        this.message = message;
        this.data = data;
    }
}