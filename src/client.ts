import { ProtectedPath, isProtectedPath } from "./both";
import { v4 as uuidv4 } from "uuid";

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
      refresh(expIn, callback, refreshPath);
    }
  }
}
function refresh(expIn: number, callback: any, refreshPath: string) {
  let interval = window.setInterval(async () => {
    const response = await window.fetch(refreshPath);
    const json = await response.json();
    window.clearInterval(interval);
    refresh(
      json.raw.expires_at * 1000 - Date.now() - 100,
      callback,
      refreshPath
    );
    return callback(json);
  }, expIn);
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
  if (
    isProtectedPath(path, protectedPath) &&
    (user === null || user === undefined)
  ) {
    auth(authPath);
  }
}

export function auth(authPath: string) {
  const stateID = uuidv4();
  localStorage.setItem("stateID", stateID);
  window
    .fetch(authPath, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stateID }),
    })
    .then((res) => {
      res.json().then((json) => {
        if (json.err === undefined || json.err === null) {
          window.location.href = json.url;
        } else {
          throw new Error(json.err);
        }
      });
    });
}

export function callback() {
  const stateID = localStorage.getItem("stateID");
  localStorage.removeItem("stateID");
  if (stateID) {
    window
      .fetch(window.location.href, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stateID }),
      })
      .then((res) => {
        res.json().then((json) => {
          if (json.err === undefined || json.err === null) {
            window.location.href = json.url;
          } else {
            throw new Error(json.err);
          }
        });
      });
  } else {
    throw new Error("NO_STATE_FOUND_IN_STR");
  }
}
