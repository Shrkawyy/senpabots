const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
function panel(){
 const ids={},events={},timers=new Map(),intervals=[],workers=[];let now=10000;class Clock extends Date {static now(){return now;}}
 let n=0,point={x:900,y:1100};
 function el(){return {style:{},value:'',tagName:'DIV',hidden:false,setAttribute(){},appendChild(){},addEventListener(){},replaceChildren(...children){this.children=children;}};}
 const root={getElementById:id=>ids[id],querySelector:()=>el(),querySelectorAll:()=>[],addEventListener(){},set innerHTML(s){for(const m of s.matchAll(/<(input|select|[a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){const e=el();e.value=(m[0].match(/value="([^"]*)"/)||[])[1]||'';e.checked=/\bchecked\b/.test(m[0]);ids[m[2]]=e;}ids.target.value='player';}};
 const document={baseURI:'https://senpa.io/web/',hidden:false,body:{appendChild(){}},createElement(){const e=el();e.attachShadow=()=>root;return e;},getElementById:()=>({value:'server'}),addEventListener(){}};
 const c={document,URL,console,Date:Clock,Number,navigator:{},setTimeout(fn,ms){const id=++n;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(){},addEventListener(type,fn){(events[type]??=[]).push(fn);},ONYXServers:{find:()=>({host:'eu1.senpa.io:7112',mode_name:'Mega'})},ONYXFfaAdapter:{wsUrl:()=> 'wss://eu1.senpa.io:7112?po=senpa.io',readJwt:()=> 'test-session'},ONYXBotGame:{target:()=>point,screenTarget:(x,y)=>({x:x*2,y:y*2}),targetScreen:p=>({x:p.x/2,y:p.y/2}),tag:()=> 'Crew'},ONYXCreateBotCodec(){const w={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.closed=true;},isAttached:()=>true};workers.push(w);return w;}};c.window=c;
 vm.runInNewContext(read('onyx-bots.js'),c);
 function start(slots=1){const [id,t]=[...timers].sort((a,b)=>a[1].ms-b[1].ms)[0];timers.delete(id);t.fn();const w=workers.at(-1);for(const data of [{type:'codec-ready'},{type:'ready',slots,border:20000}])w.onmessage({data});return w;}
 function key(type,code,tagName='BODY'){const e={code,composedPath:()=>[{tagName}],preventDefault(){},stopImmediatePropagation(){}};(events[type]||[]).forEach(fn=>fn(e));}
 return {advance:ms=>now+=ms,ids,timers,workers,start,key,events,intervals,setPoint:v=>point=v};
}
test('right-click box sends real movement, locks after release and spawns separately',()=>{
 const p=panel();p.ids.count.value='1';p.ids.box.onclick();
 const emit=(type,x,y)=>{const e={button:2,buttons:2,clientX:x,clientY:y,target:{tagName:'CANVAS'},preventDefault(){},stopImmediatePropagation(){}};(p.events[type]||[]).forEach(f=>f(e));};
 emit('mousedown',100,200);emit('mousemove',150,250);emit('mouseup',150,250);
 p.ids.connect.onclick();const w=p.start();assert.equal(w.sent.filter(m=>m.type==='spawn').length,0);
 p.ids.spawn.onclick();assert.equal(w.sent.at(-1).type,'spawn');assert.equal(w.sent.at(-2).x,300);assert.equal(w.sent.at(-2).y,500);
 emit('mousemove',800,900);p.intervals[0]();assert.equal(w.sent.at(-1).x,300);
 emit('mousedown',25,35);assert.equal(w.sent.at(-1).x,50);
 (p.events.blur||[]).forEach(f=>f());emit('mousemove',900,900);p.intervals[0]();assert.equal(w.sent.at(-1).x,50);
});
test('box without a selected position does not send spawn',()=>{
 const p=panel();p.ids.count.value='1';p.ids.box.onclick();p.ids.connect.onclick();const w=p.start();p.ids.spawn.onclick();assert.equal(w.sent.filter(m=>m.type==='spawn').length,0);
});
