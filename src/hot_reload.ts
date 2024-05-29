#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as program from "commander";
import { ScriptSourcesMgr } from "./ScriptSourcesMgr";
import * as chokidar from 'chokidar';

function addOptions(cmd: program.Command): program.Command {
    return cmd.option('-h, --host <host>', 'host to connect', '127.0.0.1')
    .option('-p, --port <port>', 'port to connect', '9222')
    .option('-r, --remoteRoot <path>', '(remote) runtime environment root directory.')
    .option('-v, --verbose', 'display trace');
}

addOptions(program.command('watch <dir>').description('watch a js project root'))
    .action(async function (dir, opts) {
        const scriptSourcesMgr = new ScriptSourcesMgr({trace: opts.verbose, localRoot: path.resolve(dir), remoteRoot: opts.remoteRoot});
        await scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
        const watcher = chokidar.watch([`${dir}/**/*.js`, `${dir}/**/*.mjs`]);

        watcher.on('change', (filePath) => {
            let fullFilePath = `${path.resolve(filePath)}`;
            scriptSourcesMgr.reload(fullFilePath, fs.readFileSync(filePath).toString());
        });
    });

addOptions(program.command('update <localRoot> <fileRelativePath>').description('update a file to remote'))
    .action(async function (localRoot, fileRelativePath, opts) {
        const scriptSourcesMgr = new ScriptSourcesMgr({trace: opts.verbose, localRoot: path.resolve(localRoot), remoteRoot: opts.remoteRoot});
        const filePath = path.join(localRoot, fileRelativePath);
        scriptSourcesMgr.setUpdateTask(path.resolve(filePath), fs.readFileSync(filePath).toString());
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });

program.parse(process.argv);
