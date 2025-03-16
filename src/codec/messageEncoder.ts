export class MessageEncoder {
    /**
     * 编码消息为二进制格式
     * 消息协议：cmd+version+clientType+messageType+appId+imeiLen+bodyLen+imeiData+bodyData
     */
    static encode(params: {
        cmd: number,
        version: string,
        clientType: number,
        messageType: number,
        appId: number,
        imei: string,
        messageBody?: string|object|null
    }): Uint8Array {
        const { cmd, version, clientType, messageType, appId, imei, messageBody} = params;
        
        //序列化messageBody
        const bodyString = typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody||"");
    
        // 将消息体转换为二进制
        const bodyBytes = new TextEncoder().encode(bodyString);
        const bodyLen = bodyBytes.length;
        //编码imei
        const imeiBytes = new TextEncoder().encode(imei);
        const imeiLen = imeiBytes.length;
        // 编码消息头
        const headerBytes = this.encodeHeader(cmd, version, clientType, messageType, appId, imeiLen, bodyLen);
        
        // 组装完整消息
        return this.assembleMessage(headerBytes, imeiBytes, bodyBytes);
    }
    
    
    private static encodeHeader(cmd: number, version: string, clientType: number, 
        messageType: number, appId: number, imeiLen: number, bodyLen: number): Uint8Array {
        const headerBytes = new Uint8Array(28); // 7个4字节的字段
        const view = new DataView(headerBytes.buffer);
        
        let offset = 0;
        view.setUint32(offset, cmd, false); offset += 4;
        // 计算 versionCode: XXYYZZ
        const [major, minor, patch] = version.split('.').map((v) => parseInt(v));
        if(major > 9999 || minor > 99 || patch > 99){
            throw new Error("versionCode is invalid");
        }
        const versionCode = (major * 10000) + (minor * 100) + patch;
        view.setUint32(offset, versionCode, false); offset += 4;
        view.setUint32(offset, clientType, false); offset += 4;
        view.setUint32(offset, messageType, false); offset += 4;
        view.setUint32(offset, appId, false); offset += 4;
        view.setUint32(offset, imeiLen, false); offset += 4;
        view.setUint32(offset, bodyLen, false);
        
        return headerBytes;
    }
    
    private static assembleMessage(headerBytes: Uint8Array, imeiBytes: Uint8Array, 
        bodyBytes: Uint8Array): Uint8Array {
        const messageBytes = new Uint8Array(headerBytes.length + imeiBytes.length + bodyBytes.length);
        
        let offset = 0;
        messageBytes.set(headerBytes, offset); offset += headerBytes.length;
        messageBytes.set(imeiBytes, offset); offset += imeiBytes.length;
        messageBytes.set(bodyBytes, offset);
        
        return messageBytes;
    }
}
