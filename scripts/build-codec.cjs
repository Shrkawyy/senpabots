'use strict';
const fs=require('node:fs'),path=require('node:path'),base=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(base,name),'utf8');
const prefix=`var emitCodecMessage;
(function(){const queue=[];let port=null;
 emitCodecMessage=message=>{if(port)port.postMessage(message);else queue.push(message);};
 const report=e=>emitCodecMessage({type:'error',msg:String(e.message||e.reason&&e.reason.message||e.reason||'Codec error')});
 self.addEventListener('error',report);self.addEventListener('unhandledrejection',report);
 function attach(e){if(e.source!==parent||e.data!=='onyx-codec-init'||!e.ports[0]||port)return;port=e.ports[0];port.onmessage=event=>{if(typeof self.onmessage==='function')self.onmessage(event);};queue.splice(0).forEach(m=>port.postMessage(m));self.removeEventListener('message',attach);}
 self.addEventListener('message',attach);
})();
emitCodecMessage({type:'log',msg:'Codec frame loaded; initializing WASM'});
`;
function build(){
 const factory=read('onyx-bot-codec.js'),match=factory.match(/const source=("(?:[^"\\]|\\.)*");/);if(!match)throw Error('Missing generated codec source');
 const worker=read('ffa/onyx-bot-worker.js').replace("importScripts('./onyx-bot-protocol.js');",()=>read('ffa/onyx-bot-protocol.js')).replace("importScripts('./wasmLoader.js');",()=>read('ffa/wasmLoader.js')).replaceAll('self.postMessage(', 'emitCodecMessage(');
 const source=prefix+'self.__ONYX_BOT_WASM_BYTES__=new Uint8Array('+JSON.stringify([...fs.readFileSync(path.join(base,'ffa/bundle.wasm'))])+');\n'+worker;
 fs.writeFileSync(path.join(base,'onyx-bot-codec.js'),factory.replace(match[0],()=> 'const source='+JSON.stringify(source)+';'));
}
if(require.main===module)build();module.exports={build};
