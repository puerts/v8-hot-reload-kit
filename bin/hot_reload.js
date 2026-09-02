#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const commander_1 = require("commander");
const ScriptSourcesMgr_1 = require("./ScriptSourcesMgr");
const program = new commander_1.Command();
function addOptions(cmd) {
    return cmd.option('-h, --host <host>', 'host to connect', 'localhost')
        .option('-p, --port <port>', 'port to connect', '9222')
        .option('-r, --remoteRoot <path>', '(remote) runtime environment root directory.')
        .option('-v, --verbose', 'display trace')
        .option('-s, --subDir <folder>', 'The subdirectory to search.')
        .option('--forceSrcType <cjs/mjs>', 'force treat source as commonjs/esm, regardless of file extension');
}
function checkRootPath(localRoot, remoteRoot) {
    const localRootArray = localRoot.split('|');
    const remoteRootArray = remoteRoot.split('|');
    const diff = localRootArray.length - remoteRootArray.length;
    if (diff > 0) {
        const lastElement = remoteRootArray[remoteRootArray.length - 1];
        remoteRootArray.push(...new Array(diff).fill(lastElement));
    }
    return [localRootArray.map((v) => path.resolve(v)), remoteRootArray];
}
function checkPartFolder(partFolder) {
    return partFolder.split('|');
}
addOptions(program.command('watch <localRoot>').description('watch a js project root'))
    .action(function (localRoot, opts) {
    const [localRootArray, remoteRootArray] = checkRootPath(localRoot, opts.remoteRoot || "");
    const partFolders = checkPartFolder(opts.subDir || "");
    const scriptSourcesMgr = new ScriptSourcesMgr_1.ScriptSourcesMgr({
        trace: opts.verbose, localRoot: localRootArray,
        remoteRoot: remoteRootArray, forceSrcType: opts.forceSrcType,
        ignorePattern: opts.ignorePattern,
        partFolders: partFolders,
    });
    scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
})
    .option('--ignorePattern <regex>', 'ignore files that matches regex');
addOptions(program.command('update <localRoot> <fileRelativePath>').description('update a file to remote'))
    .action(function (localRoot, fileRelativePath, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const [localRootArray, remoteRootArray] = checkRootPath(localRoot, opts.remoteRoot || "");
        const partFolders = checkPartFolder(opts.subDir || "");
        const scriptSourcesMgr = new ScriptSourcesMgr_1.ScriptSourcesMgr({ trace: opts.verbose, localRoot: localRootArray, remoteRoot: remoteRootArray, forceSrcType: opts.forceSrcType, partFolders: partFolders, });
        const filePath = path.join(localRoot, fileRelativePath);
        scriptSourcesMgr.setUpdateTask(path.resolve(filePath), fs.readFileSync(filePath).toString());
        scriptSourcesMgr.connect(opts.host, parseInt(opts.port));
    });
});
program.parse(process.argv);
//# sourceMappingURL=hot_reload.js.map