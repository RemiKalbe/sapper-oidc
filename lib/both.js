"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mustAuth = exports.isProtectedPath = void 0;
// Returns if the provided path must try to log the user.
function isProtectedPath(path, protectedPaths) {
    var is = false;
    for (var _i = 0, protectedPaths_1 = protectedPaths; _i < protectedPaths_1.length; _i++) {
        var el = protectedPaths_1[_i];
        var indexOf = el.path.indexOf(path);
        var andNextIsANewPath = indexOf + el.path.length + 1 >= path.length &&
            path[indexOf + el.path.length + 1] === "/";
        if ((indexOf === 0 && el.recursive && andNextIsANewPath) ||
            el.path === path) {
            is = true;
            break;
        }
    }
    return is;
}
exports.isProtectedPath = isProtectedPath;
// Returns if the user must me redirected to the auth path if no session is found.
function mustAuth(path, protectedPaths) {
    var must = false;
    for (var _i = 0, protectedPaths_2 = protectedPaths; _i < protectedPaths_2.length; _i++) {
        var el = protectedPaths_2[_i];
        var indexOf = el.path.indexOf(path);
        var andNextIsANewPath = indexOf + el.path.length + 1 >= path.length &&
            path[indexOf + el.path.length + 1] === "/";
        if (((indexOf === 0 && el.recursive && andNextIsANewPath) ||
            el.path === path) &&
            el.forceAuth) {
            must = true;
            break;
        }
    }
    return must;
}
exports.mustAuth = mustAuth;
