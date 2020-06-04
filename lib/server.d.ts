export declare class SapperOIDCClient {
    private clientID;
    private clientSecret;
    private redirectURI;
    private responseTypes;
    private domain;
    private sessionMaxAge;
    private authRequestMaxAge;
    private issuerURL;
    private client;
    private redis;
    private authPath;
    private protectedPath;
    private callbackPath;
    private authSuccessfulRedirectPath;
    private authFailedRedirectPath;
    private refreshPath;
    private scope;
    private ok;
    constructor(issuerURL: string, clientID: string, clientSecret: string, redirectURI: string, sessionMaxAge: number, authRequestMaxAge: number, authPath: string, protectedPath: string, authSuccessfulRedirectPath: string, authFailedRedirectPath: string, callbackPath: string, scope: string, refreshPath: string, redisOption: {
        host?: string;
        port?: number;
        path?: string;
        password?: string;
        family?: string;
        tls?: any;
    }, domain?: string);
    init(): Promise<void>;
    middleware(): ((req: any, res: any, next: any) => Promise<void>) | undefined;
}
