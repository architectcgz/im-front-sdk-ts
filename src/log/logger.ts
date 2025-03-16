export default class Logger {
    static debug = true;
    static info(message?:any, ...optionalParams:any[]) {
        if(Logger.debug) {
            console.info(message, ...optionalParams);
        }
    }
    static infoTag(tag:string, message?:any, ...optionalParams:any[]) {
        if(Logger.debug) {
            console.info(`[${tag}] ${message}`, ...optionalParams);
        }
    }
    static error(message?:any, ...optionalParams:any[]) {
        if(Logger.debug) {
            console.error(message, ...optionalParams);
        }
    }
    static errorTag(tag:string, message?:any, ...optionalParams:any[]) {
        if(Logger.debug) {
            console.error(`[${tag}] ${message}`, ...optionalParams);
        }
    }
    static trace(e: any):void {
        if(Logger.debug) {
            console.trace(e);
        }
    }
    static traceTag(tag:string, e: any):void {
        if(Logger.debug) {
            console.trace(`[${tag}] ${e}`);
        }
    }
}
