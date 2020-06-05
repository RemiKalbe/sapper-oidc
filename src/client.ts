import { ProtectedPath, mustAuth } from "./both";

export async function silentRenew(
  refreshPath: string,
  callback: any,
  user?: {
    raw: {
      access_token: string;
      id_token: string;
      expires_at: number;
      scope: string;
      token_type: string;
    };
  }
) {
  if (window !== undefined) {
    if (user !== null && user !== undefined) {
      const expIn = user.raw.expires_at * 1000 - Date.now() - 100;
      window.setInterval(async () => {
        const response = await window.fetch(refreshPath);
        const json = await response.json();
        return callback(json);
      }, expIn);
    }
  }
}
export function pathGuard(
  authPath: string,
  path: string,
  protectedPath: [ProtectedPath],
  user?: {
    raw: {
      access_token: string;
      id_token: string;
      expires_at: number;
      scope: string;
      token_type: string;
    };
  }
) {
  if (mustAuth(path, protectedPath) && (user === null || user === undefined)) {
    window.location.pathname = authPath;
  }
}
