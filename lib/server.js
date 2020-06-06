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
var both_1 = require("./both");
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
        this.redis = options.redisURL
            ? async_redis_1.default.createClient({ url: options.redisURL })
            : async_redis_1.default.createClient();
        this.authPath = options.authPath;
        this.protectedPaths = options.protectedPaths;
        this.callbackPath = options.callbackPath;
        this.authSuccessfulRedirectPath = options.authSuccessfulRedirectPath;
        this.authFailedRedirectPath = options.authFailedRedirectPath;
        this.refreshPath = options.refreshPath;
        this.domain = options.domain ? options.domain : "";
        this.scope = options.scope;
        this.debug = options.debug ? options.debug : false;
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
            var path, userHasValidSession, token, SID, _a, toBrowser, toStore, error_1, state, stateID, redirectURL, params, stateID, state, tokenSet, claimed, resultToStore, resultToBrowser, SID_1, error_2, error_3, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        path = req.originalUrl.replace(/\?.*$/, "");
                        // We don't want our tokens to be refreshed when the browser fetch static files.
                        if (this.debug)
                            log("Request " + path);
                        if (!(!path.includes(".") && path !== path.authFailedRedirectPath)) return [3 /*break*/, 24];
                        if (this.debug)
                            log("doesn't contain a '.' and isn't the 'authFailedRedirectPath'");
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
                        userHasValidSession = false;
                        if (this.debug)
                            log("getting tokens from request if present");
                        return [4 /*yield*/, getTokenSetFromCookie(req, this.redis)];
                    case 1:
                        token = _b.sent();
                        SID = getSIDFromCookie(req);
                        if (!(token !== undefined &&
                            token !== null &&
                            SID !== undefined &&
                            SID !== null)) return [3 /*break*/, 6];
                        if (this.debug)
                            log("has tokens and were successfully retrieved");
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 5, , 6]);
                        if (this.debug)
                            log("trying to refresh tokens");
                        return [4 /*yield*/, getRefreshedTokenSetAndClaims(token, this.client)];
                    case 3:
                        _a = _b.sent(), toBrowser = _a.toBrowser, toStore = _a.toStore;
                        if (this.debug)
                            log("tokens successfully refreshed");
                        if (this.debug)
                            log("updating tokens to db");
                        return [4 /*yield*/, updateToStore(SID, toStore, this.redis)];
                    case 4:
                        _b.sent();
                        if (this.debug)
                            log("tokens successfully saved");
                        req.user = toBrowser;
                        if (path === this.refreshPath) {
                            if (this.debug)
                                log("is a refresh request");
                            res.end(JSON.stringify(toBrowser));
                            if (this.debug)
                                log("tokens sent to frontend");
                            if (this.debug)
                                log("end of request");
                        }
                        else if (path === this.authPath) {
                            res.redirect(this.authSuccessfulRedirectPath);
                            if (this.debug)
                                log("end of request");
                        }
                        else if (path === this.callbackPath) {
                            res.redirect(this.authSuccessfulRedirectPath);
                            if (this.debug)
                                log("end of request");
                        }
                        userHasValidSession = true;
                        return [3 /*break*/, 6];
                    case 5:
                        error_1 = _b.sent();
                        if (this.debug)
                            console.log(error_1);
                        return [3 /*break*/, 6];
                    case 6:
                        if (!!userHasValidSession) return [3 /*break*/, 24];
                        if (this.debug)
                            log("doesn't have a valid session");
                        if (!(path === this.authPath)) return [3 /*break*/, 8];
                        if (this.debug)
                            log("request is the auth path");
                        state = openid_client_1.generators.state();
                        stateID = uuid_1.v4();
                        if (this.debug)
                            log("generating and saving state to db");
                        return [4 /*yield*/, this.redis.set(stateID, state, "EX", this.authRequestMaxAge)];
                    case 7:
                        _b.sent();
                        if (this.debug)
                            log("creating state cookie");
                        res.setHeader("Set-Cookie", cookie_1.serialize("state", String(stateID), {
                            httpOnly: !dev,
                            secure: !dev,
                            sameSite: true,
                            maxAge: this.authRequestMaxAge,
                            domain: this.domain,
                            path: "/",
                        }));
                        if (this.debug)
                            log("authUrl is being built");
                        redirectURL = this.client.authorizationUrl({
                            scope: this.scope,
                            code_challenge_method: "S256",
                            state: state,
                        });
                        if (this.debug)
                            log("redirect user to idp");
                        if (this.debug)
                            log("end of request");
                        res.redirect(redirectURL);
                        return [3 /*break*/, 24];
                    case 8:
                        if (!(path === this.callbackPath)) return [3 /*break*/, 23];
                        if (this.debug)
                            log("request is the callback path");
                        if (this.debug)
                            log("getting params from callback query");
                        params = this.client.callbackParams(req);
                        if (this.debug)
                            log("parsing cookie state");
                        stateID = cookie_1.parse(req.headers.cookie).state;
                        if (!(stateID === undefined || stateID === "")) return [3 /*break*/, 9];
                        if (this.debug)
                            log("no state found in cookie/no cookie named state");
                        res.redirect(this.authFailedRedirectPath);
                        return [3 /*break*/, 22];
                    case 9:
                        if (this.debug)
                            log("getting state from db");
                        return [4 /*yield*/, this.redis.get(stateID)];
                    case 10:
                        state = _b.sent();
                        _b.label = 11;
                    case 11:
                        _b.trys.push([11, 21, , 22]);
                        if (this.debug)
                            log("getting tokenset from auth");
                        return [4 /*yield*/, this.client.callback(this.redirectURI, params, {
                                state: state,
                            })];
                    case 12:
                        tokenSet = _b.sent();
                        if (this.debug)
                            log("getting token claims");
                        claimed = tokenSet.claims();
                        resultToStore = { raw: tokenSet, claimed: claimed };
                        resultToBrowser = {
                            // We don't want the refresh token to be sent to the browser
                            raw: {
                                access_token: tokenSet.access_token,
                                id_token: tokenSet.id_token,
                                expires_at: tokenSet.expires_at,
                                scope: tokenSet.scope,
                                token_type: tokenSet.token_type,
                            },
                            claimed: claimed,
                        };
                        // The user's data are sent to the browser via the sapper middleware
                        req.user = resultToBrowser;
                        if (this.debug)
                            log("creating SID in redis");
                        SID_1 = uuid_1.v4();
                        _b.label = 13;
                    case 13:
                        _b.trys.push([13, 15, , 16]);
                        return [4 /*yield*/, this.redis.set(SID_1, JSON.stringify(resultToStore), "EX", this.sessionMaxAge)];
                    case 14:
                        _b.sent();
                        return [3 /*break*/, 16];
                    case 15:
                        error_2 = _b.sent();
                        res.redirect(this.authFailedRedirectPath);
                        return [3 /*break*/, 16];
                    case 16:
                        if (this.debug)
                            log("creating SID cookie");
                        res.setHeader("Set-Cookie", cookie_1.serialize("SID", String(SID_1), {
                            httpOnly: !dev,
                            secure: !dev,
                            sameSite: true,
                            maxAge: this.sessionMaxAge,
                            domain: this.domain,
                            path: "/",
                        }));
                        _b.label = 17;
                    case 17:
                        _b.trys.push([17, 19, , 20]);
                        return [4 /*yield*/, this.redis.del(stateID)];
                    case 18:
                        _b.sent();
                        return [3 /*break*/, 20];
                    case 19:
                        error_3 = _b.sent();
                        res.end("Error deleting state from DB");
                        return [3 /*break*/, 20];
                    case 20:
                        if (this.debug)
                            log("end");
                        res.redirect(this.authSuccessfulRedirectPath);
                        return [3 /*break*/, 22];
                    case 21:
                        error_4 = _b.sent();
                        res.redirect(this.authFailedRedirectPath);
                        return [3 /*break*/, 22];
                    case 22: return [3 /*break*/, 24];
                    case 23:
                        if (both_1.isProtectedPath(path, this.protectedPaths)) {
                            if (this.debug)
                                log("request is a protected path");
                            res.redirect(this.authPath);
                        }
                        _b.label = 24;
                    case 24:
                        next();
                        return [2 /*return*/];
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
        var SID, result, tokenSet, error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    SID = getSIDFromCookie(req);
                    if (!SID) return [3 /*break*/, 6];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 5]);
                    return [4 /*yield*/, redisClient.get(SID)];
                case 2:
                    result = _a.sent();
                    tokenSet = new openid_client_1.TokenSet(JSON.parse(result).raw);
                    return [2 /*return*/, tokenSet];
                case 3:
                    error_5 = _a.sent();
                    console.log(error_5);
                    return [4 /*yield*/, redisClient.del(SID)];
                case 4:
                    _a.sent();
                    return [2 /*return*/, undefined];
                case 5: return [3 /*break*/, 7];
                case 6: return [2 /*return*/, undefined];
                case 7: return [2 /*return*/];
            }
        });
    });
}
function getRefreshedTokenSetAndClaims(tokenSet, client) {
    return __awaiter(this, void 0, void 0, function () {
        var refreshedTokenSet, claimed, resultToStore, resultToBrowser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.refresh(tokenSet)];
                case 1:
                    refreshedTokenSet = _a.sent();
                    claimed = refreshedTokenSet.claims();
                    resultToStore = { raw: refreshedTokenSet, claimed: claimed };
                    resultToBrowser = {
                        // We don't want the refresh token to be sent to the browser
                        raw: {
                            access_token: refreshedTokenSet.access_token,
                            id_token: refreshedTokenSet.id_token,
                            expires_at: refreshedTokenSet.expires_at,
                            scope: refreshedTokenSet.scope,
                            token_type: refreshedTokenSet.token_type,
                        },
                        claimed: claimed,
                    };
                    return [2 /*return*/, {
                            toStore: resultToStore,
                            toBrowser: resultToBrowser,
                        }];
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
function log(message) {
    console.log("\x1b[36m%s\x1b[0m", "[sapper-oidc]", "\x1b[0m", message);
}
