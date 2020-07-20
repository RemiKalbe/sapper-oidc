import { ProtectedPath } from "./both";
interface Options {
    issuerURL: string;
    clientID: string;
    clientSecret: string;
    redirectURI: string;
    silentRedirectURI?: string;
    sessionMaxAge: number;
    authRequestMaxAge: number;
    authPath: string;
    protectedPaths: [ProtectedPath];
    authSuccessfulRedirectPath: string;
    callbackPath: string;
    silentCallbackPath?: string;
    silentPath?: string;
    scope: string;
    refreshPath: string;
    redisURL?: string;
    debug?: boolean;
}
export declare class SapperOIDCClient {
    private clientID;
    private clientSecret;
    private redirectURI;
    private silentRedirectURI?;
    private responseTypes;
    private sessionMaxAge;
    private authRequestMaxAge;
    private issuerURL;
    private client;
    private redis;
    private authPath;
    private protectedPaths;
    private callbackPath;
    private silentCallbackPath?;
    private authSuccessfulRedirectPath;
    private refreshPath;
    private silentPath?;
    private scope;
    private ok;
    private debug;
    constructor(options: Options);
    init(): Promise<void>;
    middleware(): (req: any, res: any, next: any) => Promise<void>;
}
export {};
