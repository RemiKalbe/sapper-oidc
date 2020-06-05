export interface ProtectedPath {
  path: string;
  recursive: boolean;
  forceAuth: boolean;
}
// Returns if the provided path must try to log the user.
export function isProtectedPath(
  path: string,
  protectedPaths: [ProtectedPath]
): boolean {
  let is = false;
  for (let el of protectedPaths) {
    const indexOf = el.path.indexOf(path);
    const andNextIsANewPath =
      indexOf + el.path.length + 1 >= path.length &&
      path[indexOf + el.path.length + 1] === "/";
    if (
      (indexOf === 0 && el.recursive && andNextIsANewPath) ||
      el.path === path
    ) {
      is = true;
      break;
    }
  }
  return is;
}

// Returns if the user must me redirected to the auth path if no session is found.
export function mustAuth(
  path: string,
  protectedPaths: [ProtectedPath]
): boolean {
  let must = false;
  for (let el of protectedPaths) {
    const indexOf = el.path.indexOf(path);
    const andNextIsANewPath =
      indexOf + el.path.length + 1 >= path.length &&
      path[indexOf + el.path.length + 1] === "/";
    if (
      ((indexOf === 0 && el.recursive && andNextIsANewPath) ||
        el.path === path) &&
      el.forceAuth
    ) {
      must = true;
      break;
    }
  }
  return must;
}
