export interface ILoginResponse {
    routeInfo: {
        ip: string;
        port: number;
    };
    accessToken: string;
    refreshToken: string;
    code: number;
    message?: string;
} 