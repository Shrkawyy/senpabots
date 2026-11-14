'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');
let source=fs.readFileSync(path.join(root,'kateronyx.user.js'),'utf8');
if(!source.includes("var VERSION = '2.7.0';"))throw Error('Build the 2.7.0 hosted userscript first.');
source=source.replace("var DEFAULT_BASE_URL = 'https://senpabots.vercel.app/';","var DEFAULT_BASE_URL = 'http://127.0.0.1:3020/';")
 .replace('// @connect      senpabots.vercel.app','// @connect      senpabots.vercel.app\n// @connect      127.0.0.1\n// @connect      localhost')
 .replace(/^\/\/ @updateURL[^\r\n]*/m,'// @updateURL    none').replace(/^\/\/ @downloadURL[^\r\n]*/m,'// @downloadURL  none');
fs.writeFileSync(path.join(root,'kateronyx-local.user.js'),source);
console.log('Built local test userscript for http://127.0.0.1:3020/');
