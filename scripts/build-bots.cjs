/* Rebuild standalone and userscript bot assets from one source. */
const fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..');const read=f=>fs.readFileSync(path.join(base,f),'utf8');
const factory=read('onyx-bot-codec.js');
let user=read('kateronyx.user.js');
const start=user.indexOf('  // Embedded bot assets:');const end=user.indexOf('\n  async function mount(baseUrl)',start);
if(start<0||end<0)throw Error('Missing userscript markers');
user=user.slice(0,start)+`  // Embedded bot assets: generated from the same files as the hosted client.
  async function mountBotPanel() {
    await injectScript(${JSON.stringify(read('onyx-bot-accounts.js'))}, 'onyx-bot-accounts.js');
    await injectScript(${JSON.stringify(factory)}, 'onyx-bot-codec.js');
    await injectScript(${JSON.stringify(read('onyx-bots.js'))}, 'onyx-bots.js');
    await injectScript(${JSON.stringify(read('onyx-spectate.js'))}, 'onyx-spectate.js');
  }
`+user.slice(end);
// Version only our metadata, never CDN dependency URLs or embedded libraries.
const release='2.5.5';
user=user.replace(/^(\/\/ @version\s+)[^\r\n]+/m, (_,prefix)=>prefix+release)
 .replace(/var VERSION = '[^']+';/, ()=>`var VERSION = '${release}';`);fs.writeFileSync(path.join(base,'kateronyx.user.js'),user);
