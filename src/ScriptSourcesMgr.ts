import * as CDP from "chrome-remote-interface";
import {Protocol} from "devtools-protocol/types/protocol";
import * as path from "path";

const MAX_SCRIPTS_CACHE_SIZE = 10000000;

export class ScriptSourcesMgr {
    private _client: CDP.Client;
    private _scriptsDB = new Map<string, string>();
    private _trace: (msg: string) => void;
    private _puerts: boolean;
    private _watchRoot:string;

    constructor(params?: Partial<{ trace: boolean, watchRoot:string }>) {
        let { trace, watchRoot: remoteRoot } = params ?? {};
        this._trace = trace ? console.log : () => {};
        this._watchRoot = remoteRoot || "";
    }

    public async connect(host: string, port?: number) {
        if (this._client) {
            throw new Error("connected or connecting");
        }
        this._trace(`connting ${host}:${port} ...`);
        try {
            const local = true;
            const cfg = { host, port, local };
            let version = await CDP.Version(cfg);
            const isNode = version.Browser?.includes("node.js");
            this._puerts = version.Browser?.includes("Puerts");
            this._trace(`is node: ${isNode}, is puerts: ${this._puerts}`);
            let client = await CDP(cfg);
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

            await Runtime.enable();
            
            await Debugger.enable({ "maxScriptsCacheSize": MAX_SCRIPTS_CACHE_SIZE });

            //await Debugger.setPauseOnExceptions({state:"none"});
            //await Debugger.setAsyncCallStackDepth({maxDepth:32})
            if (isNode) {
                await Profiler.enable(); // nodejs要打开这个才能live-edit生效
                //await Debugger.setBlackboxPatterns({patterns: ["/node_modules/|/bower_components/"]});
                // for node --inspect-brk
                await client.Runtime.runIfWaitingForDebugger();
            }

            client.on("disconnect", this._onDisconnect);

            this._client = client;
            this._trace(`${host}:${port} connented.`);
        } catch (err) {
            console.error(`CONNECT_FAIL: ${err}`);
            await this.close();
        }
    }

    public async reload(pathname: string, source: string): Promise<void> {
        const pathNormalized =  path.normalize(pathname);
        if (!this._client) {
            console.warn(`not ready for ${pathNormalized}, retry later!`);
        }
        if (this._scriptsDB.has(pathNormalized)) {
            const scriptId = this._scriptsDB.get(pathNormalized);
            this._trace(`reloading ${pathNormalized}, scriptId: ${scriptId}`);
            try {
                const updateSource = (this._puerts && this.isCJS(pathNormalized)) ? `(function (exports, require, module, __filename, __dirname) { ${source}\n});` : source;
                const {scriptSource} = await this._client.Debugger.getScriptSource({scriptId});
                if (scriptSource == updateSource) {
                    this._trace(`source not changed, skip ${pathNormalized}`);
                    return;
                }
                //this._trace(`old src: ${scriptSource}`);
                //this._trace(`new src: ${updateSource}`);
                const rsp = await this._client.Debugger.setScriptSource({scriptId: scriptId, scriptSource: updateSource});
                this._trace(`reload ${pathNormalized}, scriptId: ${scriptId}, response:${JSON.stringify(rsp)}`);
            } catch (err) {
                console.error(`RELOAD_SOURCE_FAIL: ${err}, script(${scriptId}):${pathNormalized}`);
            }
        } else {
            console.warn(`can not find scriptId for ${pathNormalized}, retry later!`);
        }
    }

    private isCJS(url: string) {
        return url.endsWith(".js") && !url.startsWith("http:");
    }

    private setScriptInfo(scriptId: string, url: string) {
        let pathname = url;
        if (!this._puerts) {
            try {
                const parseUrl = new URL(url);
                if (parseUrl.protocol == "node:") {
                    return;
                }
                
                pathname = parseUrl.pathname;
                if (["http:", "https:"].includes(parseUrl.protocol)) {
                    pathname = path.join(this._watchRoot, pathname);
                } else if (process.platform == "win32" && pathname.startsWith("/")) {
                    pathname = pathname.substring(1);
                }
                
            } catch {
                return;
            }
        }
        //console.log(`url:${url}, path:${path}`);
        const pathNormalized = path.normalize(pathname);
        this._trace(`${pathNormalized} loaded, id: ${scriptId}`);
        this._scriptsDB.set(scriptId, pathNormalized);
        this._scriptsDB.set(pathNormalized, scriptId);
    }

    private _onScriptParsed = (params: Protocol.Debugger.ScriptParsedEvent) => {
        this.setScriptInfo(params.scriptId, params.url);
    }

    private _onScriptFailedToParse = (params: Protocol.Debugger.ScriptFailedToParseEvent) => {
        this.setScriptInfo(params.scriptId, params.url);
    }

    private _onDisconnect = () => {
        this._trace('>>> disconnected!');
        this._client = undefined;
    }

    public async close() {
        if (this._client) {
            let client = this._client;
            this._client = undefined;
            this._trace('closing client...');
            await client.close();
        }
    }
}
