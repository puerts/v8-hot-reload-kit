#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as program from "commander";
import { ScriptSourcesMgr } from "./ScriptSourcesMgr";

function addOptions(cmd: program.Command): program.Command {
    return cmd.option('-h, --host <host>', 'host to connect', 'localhost')
    .option('-p, --port <port>', 'port to connect', '9222')
    .option('-r, --remoteRoot <path>', '(remote) runtime environment root directory.')
    .option('-v, --verbose', 'display trace')
    .option('--forceSrcType <cjs/mjs>', 'force treat source as commonjs/esm, regardless of file extension');
}

function checkRootPath(localRoot: string, remoteRoot: string) {
    const localRootArray = localRoot.split('|');
    const remoteRootArray = remoteRoot.split('|');
    // const localRootPathArray = ;
    const diff = localRootArray.length - remoteRootArray.length;
    if (diff > 0) {
        const lastElement = remoteRootArray[remoteRootArray.length - 1];
        remoteRootArray.push(...new Array(diff).fill(lastElement));
    }
    return [localRootArray.map((v) => path.resolve(v)), remoteRootArray];
}

addOptions(program.command('watch <localRoot>').description('watch a js project root'))
    .action(function (localRoot, opts) {
        const [localRootArray, remoteRootArray] = checkRootPath(localRoot, opts.remoteRoot || "");
        const scriptSourcesMgr = new ScriptSourcesMgr({
            trace: opts.verbose, localRoot: localRootArray,
            remoteRoot: remoteRootArray, forceSrcType: opts.forceSrcType,
            ignorePattern: opts.ignorePattern,
        });
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    })
    .option('--ignorePattern <regex>', 'ignore files that matches regex');

addOptions(program.command('update <localRoot> <fileRelativePath>').description('update a file to remote'))
    .action(async function (localRoot, fileRelativePath, opts) {
        const [localRootArray, remoteRootArray] = checkRootPath(localRoot, opts.remoteRoot || "");
        const scriptSourcesMgr = new ScriptSourcesMgr({trace: opts.verbose, localRoot: localRootArray, remoteRoot: remoteRootArray, forceSrcType: opts.forceSrcType});
        const filePath = path.join(localRoot, fileRelativePath);
        scriptSourcesMgr.setUpdateTask(path.resolve(filePath), fs.readFileSync(filePath).toString());
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });

program.parse(process.argv);
