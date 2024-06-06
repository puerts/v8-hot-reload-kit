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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptSourcesMgr = void 0;
const CDP = require("chrome-remote-interface");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const MAX_SCRIPTS_CACHE_SIZE = 10000000;
class ScriptSourcesMgr {
    constructor(params) {
        this._scriptsDB = new Map();
        this._connecting = false;
        this._onScriptParsed = (params) => {
            this.setScriptInfo(params.scriptId, params.url);
        };
        this._onScriptFailedToParse = (params) => {
            this.setScriptInfo(params.scriptId, params.url);
        };
        this._onDisconnect = () => {
            this._trace('>>> disconnected!');
            this._watcher.close();
            this._watcher = undefined;
            this._client = undefined;
            this.retryConnect(1);
        };
        let { trace, localRoot, remoteRoot } = params !== null && params !== void 0 ? params : {};
        this._trace = trace ? console.log : () => { };
        this._localRoot = localRoot || "";
        this._remoteRoot = remoteRoot;
    }
    connect(host, port) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            this._host = host;
            this._port = port;
            if (this._client) {
                throw new Error("connected or connecting");
            }
            if (this._connecting) {
                console.warn(`${host}:${port} is connecting, skipped`);
            }
            console.log(`connecting ${host}:${port} ...`);
            this._connecting = true;
            try {
                this._watcher = new chokidar.FSWatcher();
                const local = true;
                const cfg = { host, port, local };
                let version = yield CDP.Version(cfg);
                const isNode = (_a = version.Browser) === null || _a === void 0 ? void 0 : _a.includes("node.js");
                this._puerts = (_b = version.Browser) === null || _b === void 0 ? void 0 : _b.includes("Puerts");
                this._trace(`is node: ${isNode}, is puerts: ${this._puerts}`);
                let client = yield CDP(cfg);
                //let client = await CDP({ target: "ws://127.0.0.1:8080/bc2a9035-bfa9-46f7-8ef2-8f304483eeae"});
                if (isNode) {
                    // for node --inspect-brk
                    client.Debugger.paused(() => {
                        client.Debugger.resume();
                    });
                }
                const { Runtime, Debugger, Profiler } = client;
                Debugger.on("scriptParsed", this._onScriptParsed);
                Debugger.on("scriptFailedToParse", this._onScriptFailedToParse);
                yield Runtime.enable();
                yield Debugger.enable({ "maxScriptsCacheSize": MAX_SCRIPTS_CACHE_SIZE });
                //await Debugger.setPauseOnExceptions({state:"none"});
                //await Debugger.setAsyncCallStackDepth({maxDepth:32})
                if (isNode) {
                    yield Profiler.enable(); // nodejs要打开这个才能live-edit生效
                    //await Debugger.setBlackboxPatterns({patterns: ["/node_modules/|/bower_components/"]});
                    // for node --inspect-brk
                    yield client.Runtime.runIfWaitingForDebugger();
                }
                client.on("disconnect", this._onDisconnect);
                this._client = client;
                console.log(`${host}:${port} connented.`);
                if (this._updateTask) {
                    try {
                        yield this.reload(this._updateTask.pathname, this._updateTask.content);
                    }
                    catch (_c) { }
                    ;
                    this.close();
                }
                else {
                    this._watcher.on('change', (filePath) => {
                        let fullFilePath = `${path.resolve(filePath)}`;
                        if (fs.existsSync(fullFilePath)) {
                            this.reload(fullFilePath, fs.readFileSync(filePath).toString());
                        }
                    });
                }
            }
            catch (err) {
                console.error(`CONNECT_FAIL: ${err}`);
                this._client = undefined;
                this._watcher = undefined;
                this.retryConnect(2);
                yield this.close();
            }
            this._connecting = false;
        });
    }
    setUpdateTask(pathname, content) {
        this._updateTask = { pathname, content };
    }
    retryConnect(delay) {
        console.log(`retry connect after ${delay} seconds`);
        setTimeout(() => this.connect(this._host, this._port), delay * 1000);
    }
    reload(pathname, source) {
        return __awaiter(this, void 0, void 0, function* () {
            const pathNormalized = path.normalize(pathname);
            if (!this._client) {
                console.warn(`remote not connected, not ready for ${pathNormalized}, retry later!`);
            }
            if (this._scriptsDB.has(pathNormalized)) {
                const scriptId = this._scriptsDB.get(pathNormalized);
                this._trace(`reloading ${pathNormalized}, scriptId: ${scriptId}`);
                try {
                    const updateSource = (this._puerts && this.isCJS(pathNormalized)) ? `(function (exports, require, module, __filename, __dirname) { ${source}\n});` : source;
                    const { scriptSource } = yield this._client.Debugger.getScriptSource({ scriptId });
                    if (scriptSource == updateSource) {
                        this._trace(`source not changed, skip ${pathNormalized}`);
                        return;
                    }
                    //this._trace(`old src: ${scriptSource}`);
                    //this._trace(`new src: ${updateSource}`);
                    const rsp = yield this._client.Debugger.setScriptSource({ scriptId: scriptId, scriptSource: updateSource });
                    this._trace(`reload ${pathNormalized}, scriptId: ${scriptId}, response:${JSON.stringify(rsp)}`);
                }
                catch (err) {
                    console.error(`RELOAD_SOURCE_FAIL: ${err}, script(${scriptId}):${pathNormalized}`);
                }
            }
            else {
                this._trace(`can not find scriptId for ${pathNormalized}.`);
            }
        });
    }
    isCJS(url) {
        return url.endsWith(".js") && !url.startsWith("http:");
    }
    setScriptInfo(scriptId, url) {
        let pathname = url;
        let isHttp = false;
        if (!this._puerts) {
            try {
                const parseUrl = new URL(url);
                if (parseUrl.protocol == "node:") {
                    return;
                }
                pathname = parseUrl.pathname;
                if (["http:", "https:"].includes(parseUrl.protocol)) {
                    isHttp = true;
                }
                else if (process.platform == "win32" && pathname.startsWith("/")) {
                    pathname = pathname.substring(1);
                }
            }
            catch (_a) {
                console.warn(``);
                return;
            }
        }
        let concatLocalRoot = false;
        if (this._remoteRoot && this._remoteRoot != this._localRoot) {
            if (pathname.startsWith(this._remoteRoot)) {
                pathname = pathname.replace(this._remoteRoot, this._localRoot);
                concatLocalRoot = true;
            }
        }
        if (isHttp && !concatLocalRoot) {
            pathname = path.join(this._localRoot, pathname);
        }
        //console.log(`url:${url}, path:${path}`);
        const pathNormalized = path.normalize(pathname);
        this._scriptsDB.set(scriptId, pathNormalized);
        this._scriptsDB.set(pathNormalized, scriptId);
        if (!fs.existsSync(pathNormalized)) {
            console.warn(`${pathNormalized} not exist! scriptId: ${scriptId}, url: ${url}`);
        }
        else {
            this._watcher.add(pathNormalized);
            console.log(`${pathNormalized} watched, scriptId: ${scriptId}, url: ${url}`);
        }
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._client) {
                this._connecting = false;
                this._watcher.close();
                this._client = undefined;
                let client = this._client;
                this._client = undefined;
                this._trace('closing client...');
                yield client.close();
            }
        });
    }
}
exports.ScriptSourcesMgr = ScriptSourcesMgr;
//# sourceMappingURL=ScriptSourcesMgr.js.map