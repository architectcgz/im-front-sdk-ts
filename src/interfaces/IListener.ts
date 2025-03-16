export interface IListener {
    onSocketConnectEvent?: (url: string, request: any) => void;
    onMessageReceived?: (message: any) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onHeartbeat?: () => void;
} 