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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SapperOIDCClient = void 0;
var openid_client_1 = require("openid-client");
var async_redis_1 = __importDefault(require("async-redis"));
var cookie_1 = require("cookie");
var uuid_1 = require("uuid");
var NODE_ENV = process.env.NODE_ENV;
var dev = NODE_ENV === "development";
var SapperOIDCClient = /** @class */ (function () {
    function SapperOIDCClient(options) {
        this.clientID = options.clientID;
        this.clientSecret = options.clientSecret;
        this.redirectURI = options.redirectURI;
        this.responseTypes = ["code"];
        this.issuerURL = options.issuerURL;
        this.sessionMaxAge = options.sessionMaxAge;
        this.authRequestMaxAge = options.authRequestMaxAge;
        this.redis = async_redis_1.default.createClient(options.redisOption);
        this.authPath = options.authPath;
        this.protectedPath = options.protectedPath;
        this.callbackPath = options.callbackPath;
        this.authSuccessfulRedirectPath = options.authSuccessfulRedirectPath;
        this.authFailedRedirectPath = options.authFailedRedirectPath;
        this.refreshPath = options.refreshPath;
        this.domain = options.domain ? options.domain : "";
        this.scope = options.scope;
    }
    SapperOIDCClient.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var discoveredIssuer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, openid_client_1.Issuer.discover(this.issuerURL)];
                    case 1:
                        discoveredIssuer = _a.sent();
                        this.client = new discoveredIssuer.Client({
                            client_id: this.clientID,
                            client_secret: this.clientSecret,
                            redirect_uris: [this.redirectURI],
                            response_types: this.responseTypes,
                        });
                        this.ok = true;
                        return [2 /*return*/];
                }
            });
        });
    };
    SapperOIDCClient.prototype.middleware = function () {
        var _this = this;
        if (!this.ok)
            throw new Error("Middfleware used before initialization");
        return function (req, res, next) { return __awaiter(_this, void 0, void 0, function () {
            var path, state, stateID, redirectURL, params, stateID, state, tokenSet, resultToStore, resultToBrowser, SID, error_1, token, SID, _a, toBrowser, toStore;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        path = req.originalUrl.replace(/\?.*$/, "");
                        // polka doesn't have res.redirect
                        res.redirect = function (location) {
                            var str = "Redirecting to " + location;
                            res.writeHead(302, {
                                Location: location,
                                "Content-Type": "text/plain",
                                "Content-Length": str.length,
                            });
                            res.end(str);
                        };
                        if (!(path === this.authPath)) return [3 /*break*/, 2];
                        state = openid_client_1.generators.state();
                        stateID = uuid_1.v4();
                        return [4 /*yield*/, this.redis.set(stateID, state, "EX", this.authRequestMaxAge)];
                    case 1:
                        _b.sent();
                        res.setHeader("Set-Cookie", cookie_1.serialize("state", String(stateID), {
                            httpOnly: true,
                            secure: !dev,
                            sameSite: true,
                            maxAge: this.authRequestMaxAge,
                            domain: this.domain,
                            path: "/",
                        }));
                        redirectURL = this.client.authorizationUrl({
                            scope: this.scope,
                            code_challenge_method: "S256",
                            state: state,
                        });
                        res.redirect(redirectURL);
                        return [3 /*break*/, 17];
                    case 2:
                        if (!(path === this.callbackPath)) return [3 /*break*/, 10];
                        params = this.client.callbackParams(req);
                        stateID = cookie_1.parse(req.headers.cookie).state;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 8, , 9]);
                        if (typeof stateID === "undefined" || stateID === "")
                            throw new Error("No state");
                        return [4 /*yield*/, this.redis.get(stateID)];
                    case 4:
                        state = _b.sent();
                        return [4 /*yield*/, this.client.callback(this.redirectURI, params, {
                                state: state,
                            })];
                    case 5:
                        tokenSet = _b.sent();
                        resultToStore = {
                            raw: tokenSet,
                            claimed: tokenSet.claims(),
                        };
                        resultToBrowser = {
                            // We don't want the refresh token to be sent to the browser
                            raw: {
                                access_token: tokenSet.access_token,
                                id_token: tokenSet.id_token,
                                expires_at: tokenSet.expires_at,
                                scope: tokenSet.scope,
                                token_type: tokenSet.token_type,
                            },
                            claimed: tokenSet.claims(),
                        };
                        req.user = resultToBrowser;
                        SID = uuid_1.v4();
                        return [4 /*yield*/, this.redis.set(SID, JSON.stringify(resultToStore), "EX", this.sessionMaxAge)];
                    case 6:
                        _b.sent();
                        res.setHeader("Set-Cookie", [
                            cookie_1.serialize("SID", String(SID), {
                                httpOnly: true,
                                secure: !dev,
                                sameSite: true,
                                maxAge: this.sessionMaxAge,
                                domain: this.domain,
                                path: "/",
                            }),
                            cookie_1.serialize("state", "", {
                                httpOnly: true,
                                secure: !dev,
                                sameSite: true,
                                maxAge: 1,
                                domain: this.domain,
                                path: "/",
                            }),
                        ]);
                        return [4 /*yield*/, this.redis.del(stateID)];
                    case 7:
                        _b.sent();
                        res.redirect(this.authSuccessfulRedirectPath);
                        return [3 /*break*/, 9];
                    case 8:
                        error_1 = _b.sent();
                        res.redirect(this.authFailedRedirectPath);
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 17];
                    case 10:
                        if (!(path === this.refreshPath || path === this.protectedPath)) return [3 /*break*/, 16];
                        return [4 /*yield*/, getTokenSetFromCookie(req, this.redis)];
                    case 11:
                        token = _b.sent();
                        SID = getSIDFromCookie(req);
                        if (!(token && SID)) return [3 /*break*/, 14];
                        return [4 /*yield*/, getRefreshedTokenSetAndClaims(token, this.client)];
                    case 12:
                        _a = _b.sent(), toBrowser = _a.toBrowser, toStore = _a.toStore;
                        return [4 /*yield*/, updateToStore(SID, toStore, this.redis)];
                    case 13:
                        _b.sent();
                        if (path === this.protectedPath) {
                            req.user = toBrowser;
                            next();
                        }
                        else {
                            res.end(toBrowser);
                        }
                        return [3 /*break*/, 15];
                    case 14:
                        next();
                        _b.label = 15;
                    case 15: return [3 /*break*/, 17];
                    case 16:
                        next();
                        _b.label = 17;
                    case 17: return [2 /*return*/];
                }
            });
        }); };
    };
    return SapperOIDCClient;
}());
exports.SapperOIDCClient = SapperOIDCClient;
function getSIDFromCookie(req) {
    return req.headers.cookie ? cookie_1.parse(req.headers.cookie).SID : undefined;
}
function getTokenSetFromCookie(req, redisClient) {
    return __awaiter(this, void 0, void 0, function () {
        var SID, json, raw;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    SID = getSIDFromCookie(req);
                    if (!SID) return [3 /*break*/, 2];
                    return [4 /*yield*/, redisClient.get(SID)];
                case 1:
                    json = _a.sent();
                    raw = json ? JSON.parse(json).raw : undefined;
                    return [2 /*return*/, raw ? new openid_client_1.TokenSet(raw) : undefined];
                case 2: return [2 /*return*/, undefined];
            }
        });
    });
}
function getRefreshedTokenSetAndClaims(tokenSet, client) {
    return __awaiter(this, void 0, void 0, function () {
        var refreshedTokenSet, resultToStore, resultToBrowser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.refresh(tokenSet)];
                case 1:
                    refreshedTokenSet = _a.sent();
                    resultToStore = {
                        raw: refreshedTokenSet,
                        claimed: refreshedTokenSet.claims(),
                    };
                    resultToBrowser = {
                        // We don't want the refresh token to be sent to the browser
                        raw: {
                            access_token: refreshedTokenSet.access_token,
                            id_token: refreshedTokenSet.id_token,
                            expires_at: refreshedTokenSet.expires_at,
                            scope: refreshedTokenSet.scope,
                            token_type: refreshedTokenSet.token_type,
                        },
                        claimed: refreshedTokenSet.claims(),
                    };
                    return [2 /*return*/, { toStore: resultToStore, toBrowser: resultToBrowser }];
            }
        });
    });
}
function updateToStore(SID, toStore, redisClient) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, redisClient.set(SID, JSON.stringify(toStore), "KEEPTTL")];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
