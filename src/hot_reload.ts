#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as program from "commander";
import { ScriptSourcesMgr } from "./ScriptSourcesMgr";

function addOptions(cmd: program.Command): program.Command {
    return cmd.option('-h, --host <host>', 'host to connect', 'localhost')
    .option('-p, --port <port>', 'port to connect', '9222')
    .option('-r, --remoteRoot <path>', '(remote) runtime environment root directory.')
    .option('-v, --verbose', 'display trace');
}

addOptions(program.command('watch <localRoot>').description('watch a js project root'))
    .action(function (localRoot, opts) {
        const scriptSourcesMgr = new ScriptSourcesMgr({trace: opts.verbose, localRoot: path.resolve(localRoot), remoteRoot: opts.remoteRoot});
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });

addOptions(program.command('update <localRoot> <fileRelativePath>').description('update a file to remote'))
    .action(async function (localRoot, fileRelativePath, opts) {
        const scriptSourcesMgr = new ScriptSourcesMgr({trace: opts.verbose, localRoot: path.resolve(localRoot), remoteRoot: opts.remoteRoot});
        const filePath = path.join(localRoot, fileRelativePath);
        scriptSourcesMgr.setUpdateTask(path.resolve(filePath), fs.readFileSync(filePath).toString());
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });

program.parse(process.argv);
