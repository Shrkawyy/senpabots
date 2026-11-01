const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'../kateronyx.user.js'),'utf8');
const start=text.indexOf('  function isOfficialRuntimeNode('),end=text.indexOf('  function stripOfficial(',start);
const context={srcOf:el=>el.src,isAllowedKeep:src=>src.startsWith('https://challenges.cloudflare.com/')||src.startsWith('blob:')};
vm.createContext(context);vm.runInContext(text.slice(start,end),context);
function frame(src){return {nodeType:1,tagName:'IFRAME',src,getAttribute(){return null;}};}
test('empty and official verification frames survive page cleanup',()=>{
 for(const src of ['', 'about:blank','about:blank#widget','https://challenges.cloudflare.com/cdn-cgi/challenge-platform/']){
  assert.equal(context.isOfficialRuntimeNode(frame(src)),false,src);
 }
});
test('original game and ad frames still get removed',()=>{
 for(const src of ['https://senpa.io/ad-frame','https://ads.example/frame']) assert.equal(context.isOfficialRuntimeNode(frame(src)),true);
});
