const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../kateronyx.user.js'),'utf8');
const start=source.indexOf('  function loadOfficialTurnstile()');
const end=source.indexOf('  function injectScript(',start);
function fixture(){
  let element,timeout,cleared=false,removed=false;
  const context={Promise,Error,console:{log(){}},
    setTimeout(fn,ms){assert.equal(ms,20000);timeout=fn;return 1;},
    clearTimeout(){cleared=true;},
    document:{createElement(tag){assert.equal(tag,'script');element={remove(){removed=true;}};return element;},head:{appendChild(el){assert.equal(el,element);}}}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  return {context,get el(){return element;},fireTimeout(){timeout();},get cleared(){return cleared;},get removed(){return removed;}};
}
test('official widget loads before game engine',async()=>{
  const f=fixture();let done=false;
  const p=f.context.loadOfficialTurnstile().then(()=>{done=true;});
  assert.equal(f.el.src,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  await Promise.resolve();assert.equal(done,false);
  f.el.onload();await p;assert.equal(done,true);assert.equal(f.cleared,true);
  const mount=source.slice(source.indexOf('  async function mount(baseUrl)'));
  assert(mount.indexOf('await loadOfficialTurnstile();')<mount.indexOf("await injectScript(deoJs,"));
});
test('blocked script rejects with actionable message',async()=>{
  const f=fixture(),p=f.context.loadOfficialTurnstile();
  f.el.onerror();await assert.rejects(p,/Allow challenges.cloudflare.com/);
  assert(f.cleared);assert(f.removed);
});
test('timeout stops startup rather than silently connecting',async()=>{
  const f=fixture(),p=f.context.loadOfficialTurnstile();
  const lateLoad=f.el.onload;f.fireTimeout();lateLoad();
  await assert.rejects(p,/timed out/);assert(f.removed);
});
