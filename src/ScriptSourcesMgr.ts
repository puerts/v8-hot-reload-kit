import * as CDP from "chrome-remote-interface";
import {Protocol} from "devtools-protocol/types/protocol";
import * as path from "path";

const MAX_SCRIPTS_CACHE_SIZE = 10000000;

export class ScriptSourcesMgr {
    private _client: CDP.Client;
    private _scriptsDB = new Map<string, string>();
    private _trace: (msg: string) => void;
    private _puerts: boolean;
    private _localRoot:string;
    private _remoteRoot:string;
    private _connecting:boolean = false;
    private _host:string;
    private _port:number;

    constructor(params?: Partial<{ trace: boolean, localRoot:string, remoteRoot:string }>) {
        let { trace, localRoot, remoteRoot } = params ?? {};
        this._trace = trace ? console.log : () => {};
        this._localRoot = localRoot || "";
        this._remoteRoot = remoteRoot;
    }

    public async connect(host: string, port?: number) {
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
            console.log(`${host}:${port} connented.`);
        } catch (err) {
            console.error(`CONNECT_FAIL: ${err}`);
            this._client = undefined;
            this.retryConnect(2);
            await this.close();
        }
        this._connecting = false;
    }

    private retryConnect(delay:number) {
        console.log(`retry connect after ${delay} seconds`);
        setTimeout(()=>this.connect(this._host, this._port), delay * 1000);
    }

    public async reload(pathname: string, source: string): Promise<void> {
        const pathNormalized =  path.normalize(pathname);
        if (!this._client) {
            console.warn(`remote not connected, not ready for ${pathNormalized}, retry later!`);
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
            this._trace(`can not find scriptId for ${pathNormalized}.`);
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
                    pathname = path.join(this._localRoot, pathname);
                } else if (process.platform == "win32" && pathname.startsWith("/")) {
                    pathname = pathname.substring(1);
                }
                
            } catch {
                return;
            }
        }
        if (this._remoteRoot && this._remoteRoot != this._localRoot) {
            if(pathname.startsWith(this._remoteRoot)) {
                pathname = pathname.replace(this._remoteRoot, this._localRoot);
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
        this.retryConnect(1);
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
