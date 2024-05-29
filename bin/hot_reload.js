#!/usr/bin/env node
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
const fs = require("fs");
const path = require("path");
const program = require("commander");
const ScriptSourcesMgr_1 = require("./ScriptSourcesMgr");
const chokidar = require("chokidar");
function addOptions(cmd) {
    return cmd.option('-h, --host <host>', 'host to connect', '127.0.0.1')
        .option('-p, --port <port>', 'port to connect', '9222')
        .option('-r, --remoteRoot <path>', '(remote) runtime environment root directory.')
        .option('-v, --verbose', 'display trace');
}
addOptions(program.command('watch <dir>').description('watch a js project root'))
    .action(function (dir, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const scriptSourcesMgr = new ScriptSourcesMgr_1.ScriptSourcesMgr({ trace: opts.verbose, localRoot: path.resolve(dir), remoteRoot: opts.remoteRoot });
        yield scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
        const watcher = chokidar.watch([`${dir}/**/*.js`, `${dir}/**/*.mjs`]);
        watcher.on('change', (filePath) => {
            let fullFilePath = `${path.resolve(filePath)}`;
            scriptSourcesMgr.reload(fullFilePath, fs.readFileSync(filePath).toString());
        });
    });
});
addOptions(program.command('update <localRoot> <fileRelativePath>').description('update a file to remote'))
    .action(function (localRoot, fileRelativePath, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const scriptSourcesMgr = new ScriptSourcesMgr_1.ScriptSourcesMgr({ trace: opts.verbose, localRoot: path.resolve(localRoot), remoteRoot: opts.remoteRoot });
        const filePath = path.join(localRoot, fileRelativePath);
        scriptSourcesMgr.setUpdateTask(path.resolve(filePath), fs.readFileSync(filePath).toString());
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });
});
program.parse(process.argv);
//# sourceMappingURL=hot_reload.js.map