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
        this.redis = options.redisURL
            ? async_redis_1.default.createClient({ url: options.redisURL })
            : async_redis_1.default.createClient();
        this.authPath = options.authPath;
        this.protectedPaths = options.protectedPaths;
        this.callbackPath = options.callbackPath;
        this.authSuccessfulRedirectPath = options.authSuccessfulRedirectPath;
        this.refreshPath = options.refreshPath;
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
                        this.redis.on("error", function (err) {
                            console.log("Error " + err);
                        });
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
            var path, userHasValidSession, token, SID, result, toBrowser, toStore, claimed, toBrowser, error_1, state, stateID, error_2, redirectURL, params, stateID, state, tokenSet, claimed, resultToStore, SID_1, error_3, error_4, error_5, error_6, error_7, error_8, error_9;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        path = req.originalUrl.replace(/\?.*$/, "");
                        if (!!path.includes(".")) return [3 /*break*/, 43];
                        // Polka doesn't have res.redirect
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
                        return [4 /*yield*/, getTokenSetFromCookie(req, this.redis)];
                    case 1:
                        token = _a.sent();
                        SID = getSIDFromCookie(req);
                        if (!(token !== undefined &&
                            token !== null &&
                            SID !== undefined &&
                            SID !== null)) return [3 /*break*/, 9];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 8, , 9]);
                        if (!(token.expires_at &&
                            token.expires_at * 1000 - Date.now() <= 600000)) return [3 /*break*/, 6];
                        return [4 /*yield*/, getRefreshedTokenSetAndClaims(token, this.client)];
                    case 3:
                        result = _a.sent();
                        if (!result) return [3 /*break*/, 5];
                        toBrowser = result.toBrowser, toStore = result.toStore;
                        return [4 /*yield*/, updateToStore(SID, toStore, this.redis)];
                    case 4:
                        _a.sent();
                        if (path === this.refreshPath) {
                            res.end(JSON.stringify(toBrowser));
                        }
                        else if (path === this.callbackPath) {
                            res.redirect(this.authSuccessfulRedirectPath);
                        }
                        else {
                            req.user = toBrowser;
                        }
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        try {
                            claimed = token.claims();
                            toBrowser = {
                                // We don't want the refresh token to be sent to the browser
                                raw: {
                                    access_token: token.access_token,
                                    id_token: token.id_token,
                                    expires_at: token.expires_at,
                                    scope: token.scope,
                                    token_type: token.token_type,
                                },
                                claimed: claimed,
                            };
                            if (path === this.refreshPath) {
                                res.end(JSON.stringify(toBrowser));
                            }
                            else if (path === this.callbackPath) {
                                res.redirect(this.authSuccessfulRedirectPath);
                            }
                            else {
                                req.user = toBrowser;
                            }
                        }
                        catch (error) {
                            log("Error: We were not able to get the data from the token (claims)");
                        }
                        _a.label = 7;
                    case 7:
                        userHasValidSession = true;
                        return [3 /*break*/, 9];
                    case 8:
                        error_1 = _a.sent();
                        log("Unknow error:");
                        console.log(error_1);
                        return [3 /*break*/, 9];
                    case 9:
                        if (!!userHasValidSession) return [3 /*break*/, 43];
                        if (!(path === this.authPath && req.method == "POST")) return [3 /*break*/, 16];
                        state = openid_client_1.generators.state();
                        stateID = req.body.stateID;
                        if (!stateID) return [3 /*break*/, 14];
                        _a.label = 10;
                    case 10:
                        _a.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, this.redis.set(stateID, state, "EX", this.authRequestMaxAge)];
                    case 11:
                        _a.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        error_2 = _a.sent();
                        log("Error: We were not able to store the state in the DB, check the following logs from redis:");
                        console.log(error_2);
                        res.end(JSON.stringify({ err: "DB_ERR" }));
                        return [3 /*break*/, 13];
                    case 13:
                        // We then send the redirect URL back to the frontend, the frontend will
                        // take care of redirecting the user to the idp.
                        try {
                            redirectURL = this.client.authorizationUrl({
                                scope: this.scope,
                                code_challenge_method: "S256",
                                state: state,
                            });
                            res.end(JSON.stringify({ url: redirectURL }));
                        }
                        catch (error) {
                            log("Error: We were not able to generate the authorization url, check the following logs:");
                            console.log(error);
                            res.end(JSON.stringify({ err: "AUTH_URL_ERR" }));
                        }
                        return [3 /*break*/, 15];
                    case 14:
                        log("Error: No stateID found in request");
                        res.end(JSON.stringify({ err: "NO_STATEID_FOUND_IN_REQ" }));
                        _a.label = 15;
                    case 15: return [3 /*break*/, 43];
                    case 16:
                        if (!(path === this.callbackPath && req.method == "POST")) return [3 /*break*/, 43];
                        _a.label = 17;
                    case 17:
                        _a.trys.push([17, 42, , 43]);
                        params = this.client.callbackParams(req.originalUrl);
                        _a.label = 18;
                    case 18:
                        _a.trys.push([18, 40, , 41]);
                        stateID = req.body.stateID;
                        if (!(stateID === null ||
                            stateID === undefined ||
                            stateID === "")) return [3 /*break*/, 19];
                        log("Error: No state found");
                        res.end(JSON.stringify({ err: "NO_STATE_FOUND_IN_REQ" }));
                        return [3 /*break*/, 39];
                    case 19:
                        _a.trys.push([19, 38, , 39]);
                        return [4 /*yield*/, this.redis.get(stateID)];
                    case 20:
                        state = _a.sent();
                        if (!state) return [3 /*break*/, 36];
                        _a.label = 21;
                    case 21:
                        _a.trys.push([21, 34, , 35]);
                        return [4 /*yield*/, this.client.callback(this.redirectURI, params, {
                                state: state,
                            })];
                    case 22:
                        tokenSet = _a.sent();
                        _a.label = 23;
                    case 23:
                        _a.trys.push([23, 32, , 33]);
                        claimed = tokenSet.claims();
                        resultToStore = { raw: tokenSet, claimed: claimed };
                        SID_1 = uuid_1.v4();
                        _a.label = 24;
                    case 24:
                        _a.trys.push([24, 30, , 31]);
                        return [4 /*yield*/, this.redis.set(String(SID_1), JSON.stringify(resultToStore), "EX", this.sessionMaxAge)];
                    case 25:
                        _a.sent();
                        res.setHeader("Set-Cookie", cookie_1.serialize("SID", String(SID_1), {
                            httpOnly: !dev,
                            secure: !dev,
                            sameSite: true,
                            maxAge: this.sessionMaxAge,
                            path: "/",
                        }));
                        _a.label = 26;
                    case 26:
                        _a.trys.push([26, 28, , 29]);
                        return [4 /*yield*/, this.redis.del(stateID)];
                    case 27:
                        _a.sent();
                        return [3 /*break*/, 29];
                    case 28:
                        error_3 = _a.sent();
                        log("Error: We were not able to delete the state from the DB, see the following logs:");
                        console.log(error_3);
                        res.end(JSON.stringify({ err: "DB_ERR" }));
                        return [3 /*break*/, 29];
                    case 29:
                        res.end(JSON.stringify({
                            url: this.authSuccessfulRedirectPath,
                        }));
                        return [3 /*break*/, 31];
                    case 30:
                        error_4 = _a.sent();
                        log("Error: We were not able to save the session to the db, check the following logs:");
                        console.log(error_4);
                        res.end(JSON.stringify({ err: "DB_ERR" }));
                        return [3 /*break*/, 31];
                    case 31: return [3 /*break*/, 33];
                    case 32:
                        error_5 = _a.sent();
                        log("Error: We were not able to claims the tokens, see the following logs:");
                        console.log(error_5);
                        res.end(JSON.stringify({ err: "CLAIMS_ERR" }));
                        return [3 /*break*/, 33];
                    case 33: return [3 /*break*/, 35];
                    case 34:
                        error_6 = _a.sent();
                        log("Error: We were not able to perform the callback for Authorization Server's authorization response, see the logs bellow:");
                        console.log(error_6);
                        res.end(JSON.stringify({ err: "CALLBACK_ERR" }));
                        return [3 /*break*/, 35];
                    case 35: return [3 /*break*/, 37];
                    case 36:
                        log("Error: No state found in db");
                        res.end(JSON.stringify({ err: "NO_STATE_FOUND_IN_DB" }));
                        _a.label = 37;
                    case 37: return [3 /*break*/, 39];
                    case 38:
                        error_7 = _a.sent();
                        log("Error: An error occured when fetching the state from the DB, see the error bellow:");
                        console.log(error_7);
                        res.end(JSON.stringify({ err: "DB_ERR" }));
                        return [3 /*break*/, 39];
                    case 39: return [3 /*break*/, 41];
                    case 40:
                        error_8 = _a.sent();
                        log("Error: body is undefined, have you forgot bodyParser middleware?");
                        return [3 /*break*/, 41];
                    case 41: return [3 /*break*/, 43];
                    case 42:
                        error_9 = _a.sent();
                        log("Error: We were not able to get the params from the callback, see the following logs:");
                        console.log(error_9);
                        res.end(JSON.stringify({ err: "NO_PARAMS_FOUND" }));
                        return [3 /*break*/, 43];
                    case 43:
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
        var SID, result, tokenSet, error_10, error_11;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    SID = getSIDFromCookie(req);
                    if (!SID) return [3 /*break*/, 11];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    return [4 /*yield*/, redisClient.get(SID)];
                case 2:
                    result = _a.sent();
                    if (!result) return [3 /*break*/, 7];
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 4, , 6]);
                    tokenSet = new openid_client_1.TokenSet(JSON.parse(result).raw);
                    return [2 /*return*/, tokenSet];
                case 4:
                    error_10 = _a.sent();
                    // It would mean that the data stored in the DB are not correctly formated. We don't want that.
                    return [4 /*yield*/, redisClient.del(SID)];
                case 5:
                    // It would mean that the data stored in the DB are not correctly formated. We don't want that.
                    _a.sent();
                    return [2 /*return*/, undefined];
                case 6: return [3 /*break*/, 8];
                case 7: return [2 /*return*/, undefined];
                case 8: return [3 /*break*/, 10];
                case 9:
                    error_11 = _a.sent();
                    return [2 /*return*/, undefined];
                case 10: return [3 /*break*/, 12];
                case 11: return [2 /*return*/, undefined];
                case 12: return [2 /*return*/];
            }
        });
    });
}
function getRefreshedTokenSetAndClaims(tokenSet, client) {
    return __awaiter(this, void 0, void 0, function () {
        var refreshedTokenSet, claimed, resultToStore, resultToBrowser, error_12;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, client.refresh(tokenSet)];
                case 1:
                    refreshedTokenSet = _a.sent();
                    try {
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
                    catch (error) {
                        log("Error: We were not able to get the data from the token (claims)");
                        return [2 /*return*/, undefined];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_12 = _a.sent();
                    log("Error: We were not able to refresh the tokens");
                    return [2 /*return*/, undefined];
                case 3: return [2 /*return*/];
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
