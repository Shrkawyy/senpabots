const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function panel(storage=new Map()){
 const ids={},events={},timers=new Map(),intervals=[],workers=[];let now=10000;class Clock extends Date {static now(){return now;}}
 let n=0,point={x:900,y:1100};
 function el(){return {set id(v){this._id=v;ids[v]=this;},get id(){return this._id;},style:{},value:'',tagName:'DIV',hidden:false,setAttribute(){},appendChild(){},addEventListener(){},replaceChildren(...children){this.children=children;}};}
 const root={getElementById:id=>ids[id],querySelector:()=>el(),querySelectorAll:()=>[],addEventListener(){},set innerHTML(s){for(const m of s.matchAll(/<(input|select|[a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const e=el();e.value=(m[0].match(/value="([^"]*)"/)||[])[1]||'';e.checked=/\bchecked\b/.test(m[0]);ids[m[2]]=e;}ids.target.value='player';}};
 const document={baseURI:'https://senpa.io/web/',hidden:false,body:{appendChild(){}},createElement(){const e=el();e.attachShadow=()=>root;return e;},getElementById:()=>({value:'server'}),addEventListener(){}};
 const c={atob,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async()=>({ok:true,json:async()=>({name:'Test account'})}),open:()=>({focus(){},postMessage(){},close(){}}),document,URL,console,Date:Clock,Number,navigator:{},setTimeout(fn,ms){const id=++n;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){},addEventListener(type,fn){(events[type]??=[]).push(fn);},ONYXServers:{find:()=>({host:'eu1.senpa.io:7112',mode_name:'Mega'})},ONYXFfaAdapter:{wsUrl:()=> 'wss://eu1.senpa.io:7112?po=senpa.io',readJwt:()=> 'null'},ONYXBotGame:{target:()=>point,tag:()=> 'Crew'},ONYXCreateBotCodec(){const w={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.closed=true;},isAttached:()=>true};workers.push(w);return w;}};c.window=c;
 vm.createContext(c);vm.runInContext(read('onyx-bot-accounts.js'),c);vm.runInContext(read('onyx-bots.js'),c);
 function start(slots=1){const [id,t]=[...timers].sort((a,b)=>a[1].ms-b[1].ms)[0];timers.delete(id);t.fn();const w=workers.at(-1);for(const data of [{type:'codec-ready'},{type:'ready',slots,border:20000}])w.onmessage({data});return w;}
 function key(type,code,tagName='BODY'){const e={code,composedPath:()=>[{tagName}],preventDefault(){},stopImmediatePropagation(){}};(events[type]||[]).forEach(fn=>fn(e));}
 return {c,storage,advance:ms=>now+=ms,ids,timers,workers,start,key,events,intervals,setPoint:v=>point=v};
}

const jwt='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.signature';
function saved(spawn=false){return new Map([['onyx:eu-facebook-bots:v1',JSON.stringify([{id:1,provider:'facebook',token:jwt,wanted:true,host:'eu1.senpa.io:7112',spawn}])]]);}
test('saved Facebook sessions revalidate, 30 slots, reject Discord, logout clears stored token',async()=>{
 const p=panel(saved());await p.c.ONYXBotAccounts.ready;const a=p.c.ONYXBotAccounts;
 assert.equal(a.count,30);assert.equal(a.getStatus(1).verified,true);assert.equal(a.login(2,'discord'),false);
 assert.equal(a.getStatus(30).provider,'facebook');a.clear(1);assert.equal(a.getToken(1),null);
 assert.equal(JSON.parse(p.storage.get('onyx:eu-facebook-bots:v1'))[0].token,null);
});
test('reload reconnects saved account, two two-player connections total four, ACTIVE and Ban indicators',async()=>{
 const p=panel(saved(true));await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();
 const w=p.workers[0];assert(w);w.onmessage({data:{type:'codec-ready'}});
 assert.equal(w.sent[0].slotLimit,4);assert.equal(w.sent[0].token,jwt);
 w.onmessage({data:{type:'ready',slots:2,assignedSlots:2}});
 assert(p.ids['account-status-1'].textContent.includes('ACTIVE'));
 const second=p.start(2);assert.equal(second.sent[0].slotLimit,2);assert.equal(p.workers.length,2);
 assert.equal(second.sent[0].token,jwt);assert(second.sent.some(m=>m.type==='spawn'));
 w.onmessage({data:{type:'close',code:1006,reason:'Network error'}});
 assert(!p.ids['account-status-1'].textContent.includes('BAN'));
 second.onmessage({data:{type:'close',code:4101,reason:'Account banned'}});
 assert(p.ids['account-status-1'].textContent.includes('BAN'));assert.equal(p.c.ONYXBotAccounts.getStatus(1).wanted,false);
});
test('pagehide keeps reconnect intent while Stop All disables it',async()=>{
 const p=panel(saved());await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();
 p.events.pagehide[0]();assert.equal(p.c.ONYXBotAccounts.getStatus(1).wanted,true);
 p.ids.stop.onclick();assert.equal(p.c.ONYXBotAccounts.getStatus(1).wanted,false);
});
test('four granted slots do not open another connection; disconnect cancels queued supplement',async()=>{
 const p=panel(saved());await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();
 const w=p.workers[0];w.onmessage({data:{type:'codec-ready'}});w.onmessage({data:{type:'ready',slots:4}});
 assert.equal(p.timers.size,0);assert.equal(p.workers.length,1);p.ids['account-disconnect-1'].onclick();assert(w.closed);
 const q=panel(saved());await q.c.ONYXBotAccounts.ready;await Promise.resolve();q.intervals[0]();
 q.workers[0].onmessage({data:{type:'ready',slots:2}});q.ids['account-disconnect-1'].onclick();assert.equal(q.timers.size,0);
});
test('expired saved token is not restored, HTTP 403 is not labelled a ban',async()=>{
 const data=saved();const row=JSON.parse(data.get('onyx:eu-facebook-bots:v1'));
 row[0].token='eyJhbGciOiJub25lIn0.'+Buffer.from(JSON.stringify({exp:1})).toString('base64url')+'.signature';
 data.set('onyx:eu-facebook-bots:v1',JSON.stringify(row));const p=panel(data);await p.c.ONYXBotAccounts.ready;
 assert.equal(p.c.ONYXBotAccounts.getToken(1),null);p.intervals[0]();assert.equal(p.workers.length,0);
 const q=panel();await q.c.ONYXBotAccounts.ready;q.c.fetch=async()=>({ok:false,status:403});
 const popup={focus(){},postMessage(){}};q.c.open=()=>popup;q.c.ONYXBotAccounts.login(1,'facebook');
 q.events.message[0]({origin:'https://api.senpa.io',source:popup,data:{access_token:jwt},stopImmediatePropagation(){}});
 await new Promise(r=>setImmediate(r));assert.equal(q.c.ONYXBotAccounts.getStatus(1).banHost,'');assert.equal(q.c.ONYXBotAccounts.getStatus(1).verified,false);
});
