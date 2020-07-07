"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.callback = exports.auth = exports.pathGuard = exports.silentRenew = void 0;
var both_1 = require("./both");
var uuid_1 = require("uuid");
function silentRenew(refreshPath, callback, user) {
    return __awaiter(this, void 0, void 0, function () {
        var expIn;
        return __generator(this, function (_a) {
            if (window !== undefined) {
                if (user !== null && user !== undefined) {
                    expIn = user.raw.expires_at * 1000 - Date.now() - 120000;
                    refresh(expIn, callback, refreshPath);
                }
            }
            return [2 /*return*/];
        });
    });
}
exports.silentRenew = silentRenew;
function refresh(expIn, callback, refreshPath) {
    var _this = this;
    var interval = window.setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
        var response, json;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, window.fetch(refreshPath)];
                case 1:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = _a.sent();
                    window.clearInterval(interval);
                    if (json) {
                        refresh(json.raw.expires_at * 1000 - Date.now() - 120000, callback, refreshPath);
                    }
                    return [2 /*return*/, callback(json)];
            }
        });
    }); }, expIn);
}
function pathGuard(authPath, path, protectedPath, user) {
    if (both_1.isProtectedPath(path, protectedPath) &&
        (user === null || user === undefined)) {
        localStorage.setItem("where_at", window.location.href);
        auth(authPath);
    }
}
exports.pathGuard = pathGuard;
function auth(authPath) {
    var stateID = uuid_1.v4();
    localStorage.setItem("stateID", stateID);
    window
        .fetch(authPath + "?stateID=" + stateID, {
        method: "POST",
    })
        .then(function (res) {
        res.json().then(function (json) {
            if (json.err === undefined || json.err === null) {
                window.location.href = json.url;
            }
            else {
                throw new Error(json.err);
            }
        });
    });
}
exports.auth = auth;
function callback(redirectBack) {
    var stateID = localStorage.getItem("stateID");
    localStorage.removeItem("stateID");
    if (stateID) {
        window
            .fetch(window.location.href + "&stateID=" + stateID, {
            method: "POST",
        })
            .then(function (res) {
            res.json().then(function (json) {
                var back = localStorage.getItem("where_at");
                if ((json.err === undefined || json.err === null) &&
                    back !== undefined &&
                    back !== null) {
                    if (redirectBack) {
                        window.location.href = back;
                    }
                    else {
                        window.location.href = json.url;
                    }
                }
                else {
                    throw new Error(json.err);
                }
            });
        });
    }
    else {
        throw new Error("NO_STATE_FOUND_IN_STR");
    }
}
exports.callback = callback;
