'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../..',f),'utf8');
function panel(storage=new Map()){
 const ids={},events={},timers=new Map(),intervals=[],workers=[];let now=10000;class Clock extends Date {static now(){return now;}}
 let n=0,point={x:900,y:1100},primaryReads=0;
 function el(){return {set id(v){this._id=v;ids[v]=this;},get id(){return this._id;},style:{},value:'',tagName:'DIV',hidden:false,setAttribute(){},appendChild(){},addEventListener(){},replaceChildren(...children){this.children=children;}};}
 const root={getElementById:id=>ids[id],querySelector:()=>el(),querySelectorAll:()=>[],addEventListener(){},set innerHTML(s){for(const m of s.matchAll(/<(input|select|[a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const e=el();e.value=(m[0].match(/value="([^"]*)"/)||[])[1]||'';e.checked=/\bchecked\b/.test(m[0]);ids[m[2]]=e;}ids.target.value='player';}};
 const document={baseURI:'https://senpa.io/web/',hidden:false,body:{appendChild(){}},createElement(){const e=el();e.attachShadow=()=>root;return e;},getElementById:()=>({value:'server'}),addEventListener(){}};
 const c={atob,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async()=>({ok:true,json:async()=>({name:'Test account'})}),open:()=>({focus(){},postMessage(){},close(){}}),document,URL,console,Date:Clock,Number,navigator:{},setTimeout(fn,ms){const id=++n;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){},addEventListener(type,fn){(events[type]??=[]).push(fn);},ONYXServers:{find:()=>({host:'eu1.senpa.io:7112',mode_name:'Mega'})},ONYXFfaAdapter:{wsUrl:()=> 'wss://eu1.senpa.io:7112?po=senpa.io',readJwt:()=>{primaryReads++;return 'primary-must-not-be-used';}},ONYXBotGame:{target:()=>point,tag:()=> 'Crew',screenTarget:(x,y)=>({x:x*2,y:y*3})},ONYXCreateBotCodec(){const w={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.closed=true;},isAttached:()=>true};workers.push(w);return w;}};c.window=c;
 vm.createContext(c);vm.runInContext(read('onyx-bot-accounts.js'),c);vm.runInContext(read('onyx-bots.js'),c);
 function start(slots=1){const [id,t]=[...timers].sort((a,b)=>a[1].ms-b[1].ms)[0];timers.delete(id);t.fn();const w=workers.at(-1);for(const data of [{type:'codec-ready'},{type:'ready',slots,border:20000}])w.onmessage({data});return w;}
 function key(type,code,tagName='BODY'){const e={code,composedPath:()=>[{tagName}],preventDefault(){},stopImmediatePropagation(){}};(events[type]||[]).forEach(fn=>fn(e));}
 return {c,storage,advance:ms=>now+=ms,ids,timers,workers,start,key,events,intervals,get primaryReads(){return primaryReads;},setPoint:v=>point=v};
}

const jwt='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
function saved(spawn=false){return new Map([['onyx:eu-facebook-bots:v1',JSON.stringify([{id:1,provider:'facebook',token:jwt,wanted:true,host:'eu1.senpa.io:7112',spawn}])]]);}
module.exports={panel,saved,jwt};
