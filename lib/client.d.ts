import { ProtectedPath } from "./both";
export declare function silentRenew(refreshPath: string, callback: any, user?: {
    raw: {
        access_token: string;
        id_token: string;
        expires_at: number;
        scope: string;
        token_type: string;
    };
}): Promise<void>;
export declare function pathGuard(authPath: string, path: string, protectedPath: [ProtectedPath], user?: {
    raw: {
        access_token: string;
        id_token: string;
        expires_at: number;
        scope: string;
        token_type: string;
    };
}): void;
export declare function auth(authPath: string): void;
export declare function callback(redirectBack: boolean): void;
