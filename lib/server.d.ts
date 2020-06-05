import { ProtectedPath } from "./both";
interface Options {
    issuerURL: string;
    clientID: string;
    clientSecret: string;
    redirectURI: string;
    sessionMaxAge: number;
    authRequestMaxAge: number;
    authPath: string;
    protectedPaths: [ProtectedPath];
    authSuccessfulRedirectPath: string;
    authFailedRedirectPath: string;
    callbackPath: string;
    scope: string;
    refreshPath: string;
    forcedRefreshPath: string;
    redisOption: {
        host?: string;
        port?: number;
        path?: string;
        password?: string;
        family?: string;
        tls?: any;
    };
    domain?: string;
}
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
    private protectedPaths;
    private callbackPath;
    private authSuccessfulRedirectPath;
    private authFailedRedirectPath;
    private refreshPath;
    private forcedRefreshPath;
    private scope;
    private ok;
    constructor(options: Options);
    init(): Promise<void>;
    middleware(): (req: any, res: any, next: any) => Promise<void>;
}
export {};
