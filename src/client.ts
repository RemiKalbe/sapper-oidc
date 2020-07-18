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
      const expIn = user.raw.expires_at * 1000 - Date.now() - 120000;
      refresh(expIn, callback, refreshPath);
    }
  }
}
function refresh(expIn: number, callback: any, refreshPath: string) {
  let interval = window.setInterval(async () => {
    const response = await window.fetch(refreshPath);
    const json = await response.json();
    window.clearInterval(interval);
    if (json) {
      refresh(
        json.raw.expires_at * 1000 - Date.now() - 120000,
        callback,
        refreshPath
      );
    }
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
    localStorage.setItem("where_at", window.location.href);
    auth(authPath);
  }
}

export function auth(authPath: string) {
  const stateID = uuidv4();
  localStorage.setItem("stateID", stateID);
  window
    .fetch(`${authPath}?stateID=${stateID}`, {
      method: "POST",
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

export function callback(redirectBack: boolean) {
  const stateID = localStorage.getItem("stateID");
  localStorage.removeItem("stateID");
  if (stateID) {
    window
      .fetch(`${window.location.href}&stateID=${stateID}`, {
        method: "POST",
      })
      .then((res) => {
        res.json().then((json) => {
          const back = localStorage.getItem("where_at");
          if (json.err === undefined || json.err === null) {
            if (redirectBack && back !== undefined && back !== null) {
              window.location.href = back;
            } else {
              window.location.href = json.url;
            }
          } else {
            throw new Error(json.err);
          }
        });
      });
  } else {
    throw new Error("NO_STATE_FOUND_IN_STR");
  }
}

export function silentCallback(goto: (e: any) => {}, callback: (e: any) => {}) {
  const stateID = localStorage.getItem("stateID");
  const back = localStorage.getItem("where_at");
  localStorage.removeItem("stateID");
  if (stateID) {
    window
      .fetch(`${window.location.href}&stateID=${stateID}`, {
        method: "POST",
        credentials: "same-origin",
      })
      .then((res) => {
        res.json().then((json) => {
          if (json && json.raw && json.claimed) {
            callback(json);
          }
          goto(back ? back : "/");
        });
      });
  } else if (back) {
    goto(back);
  } else {
    goto("/");
  }
}

export function silentLogin() {
  if (window) {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect_to = urlParams.get("redirect_to");
    const stateID = urlParams.get("stateID");
    const back = urlParams.get("where_at");
    if (back && redirect_to && stateID) {
      const whereAt = window.atob(back);
      localStorage.setItem("where_at", whereAt);
      localStorage.setItem("stateID", stateID);
      window.location.replace(window.atob(redirect_to));
    } else {
      throw new Error("MISSING_EXPECTED_PARAMS");
    }
  }
}
