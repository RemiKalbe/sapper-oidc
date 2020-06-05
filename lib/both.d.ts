export interface ProtectedPath {
    path: string;
    recursive: boolean;
    forceAuth: boolean;
}
export declare function isProtectedPath(path: string, protectedPaths: [ProtectedPath]): boolean;
export declare function mustAuth(path: string, protectedPaths: [ProtectedPath]): boolean;
