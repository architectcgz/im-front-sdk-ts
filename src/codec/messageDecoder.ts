interface DecodedMessage {
    cmd: number;
    body: any;
}
/**
 * 收到的消息为二进制格式
 * 消息协议：cmd+dataLen+jsonData
 */
export class MessageDecoder {
    public static decode(data: Blob): Promise<DecodedMessage> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target!.result as ArrayBuffer;
                    const dataView = new DataView(arrayBuffer);
                    
                    // 解析消息头
                    const cmd = dataView.getUint32(0);
                    const dataLen = dataView.getUint32(4);
                    
                    // 解析消息体
                    const jsonData = new TextDecoder().decode(
                        new DataView(arrayBuffer, 8, dataLen)
                    );
                    
                    // 返回解析后的数据结构
                    resolve({
                        cmd,
                        body: JSON.parse(jsonData)
                    });
                } catch (error) {
                    reject(new Error('消息解码失败: ' + (error as Error).message));
                }
            };

            reader.onerror = () => {
                reject(new Error('FileReader 读取失败'));
            };

            reader.readAsArrayBuffer(data);
        });
    }
}
