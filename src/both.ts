export interface ProtectedPath {
  path: string;
  recursive: boolean;
}
// Returns if the user must me redirected to the auth path if no session is found.
export function isProtectedPath(
  path: string,
  protectedPaths: [ProtectedPath]
): boolean {
  let is = false;
  for (let el of protectedPaths) {
    const indexOf = path.indexOf(el.path);
    const andNextIsANewPath =
      indexOf + el.path.length <= path.length &&
      path[indexOf + el.path.length] === "/";
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
