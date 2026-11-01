const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../deo.onyx.beautified.js'),'utf8');
const helper=source.slice(0,source.indexOf('})(window);')+'})(window);'.length);
function fixture(){
 const widgets=[],sent=[],logs=[],removed=[];let time=100;
 const SC={init(){return 'connected';},onClose(){},onError(){},onMessage(){}};
 const window={SC,turnstile:{render(el,options){widgets.push(options);return widgets.length-1;},remove(id){removed.push(id);}}};
 const c={window,performance:{now:()=>time},console:{info:(...x)=>logs.push(x)},DataView,Uint8Array,ArrayBuffer};
 vm.createContext(c);vm.runInContext(helper,c);
 return {window,widgets,sent,logs,removed,tick(ms){time+=ms;},show(type=1,tab=1){window.ONYXVerification.show({type,tab,container:{},sitekey:'key',show(){},hide(){},send:(...x)=>sent.push(x)});}};
}
test('fresh result sent once with requested type and captured tab; no token in logs',()=>{
 const f=fixture();f.show(2,2);f.tick(1500);f.widgets[0].callback('secret-result');f.widgets[0].callback('secret-result');
 assert.deepEqual(f.sent,[[2,'secret-result',2]]);assert(!JSON.stringify(f.logs).includes('secret-result'));assert(JSON.stringify(f.logs).includes('widget-completed-ms=1500'));
});
test('new challenge removes widget 0 and invalidates its pending callback',()=>{
 const f=fixture();f.show(1,1);f.show(2,2);f.widgets[0].callback('old');f.widgets[1].callback('new');assert.deepEqual(f.sent,[[2,'new',2]]);assert.deepEqual(f.removed,[0]);
});
for(const event of ['onClose','onError','init'])test(event+' prevents sending into a replacement connection',()=>{
 const f=fixture();f.show();if(event==='init')assert.equal(f.window.SC.init('host',1),'connected');else f.window.SC[event](1);
 f.widgets[0].callback('old');assert.equal(f.sent.length,0);
});
for(const event of ['expired-callback','error-callback'])test(event+' invalidates result without an automatic retry',()=>{
 const f=fixture();f.show();f.widgets[0][event]('test-code');f.widgets[0].callback('expired');assert.equal(f.sent.length,0);assert.equal(f.widgets.length,1);
});
test('server reply latency is recorded without interpreting success',()=>{
 const f=fixture();f.show();f.widgets[0].callback('result');f.tick(37);f.window.SC.onMessage(Uint8Array.from([41,1]),1);assert(JSON.stringify(f.logs).includes('server-message-after-submit-ms=37'));
});
