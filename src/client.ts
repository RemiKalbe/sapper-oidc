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
  const expIn = raw.expires_at - new Date().getSeconds() - 100;
  console.log("Exp in " + expIn);
  setInterval(async () => {
    return callback(await window.fetch(refreshPath));
  }, expIn);
}
