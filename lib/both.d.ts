export interface ProtectedPath {
    path: string;
    recursive: boolean;
}
export declare function isProtectedPath(path: string, protectedPaths: [ProtectedPath]): boolean;
