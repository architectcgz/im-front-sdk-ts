import '../src/pack/messagePack'
import { MessagePack } from '../src/pack/messagePack'
let a = new MessagePack(10000)
a.appId = 1;
a.buildTextMessagePack("1","2","1发给2的消息")
console.log(a.messageBody)
