export function silentRenew(
  refreshPath: string,
  raw: {
    access_token: string;
    id_token: string;
    expires_at: number;
    scope: string;
    token_type: string;
  },
  callback: any
) {
  if (typeof window !== "undefined") {
    const expIn = raw.expires_at - new Date().getSeconds();
    setInterval(async () => {
      return callback(await window.fetch(refreshPath));
    }, expIn);
  }
}
