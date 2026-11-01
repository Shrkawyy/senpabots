const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const full=fs.readFileSync(path.join(__dirname,'../deo.onyx.beautified.js'),'utf8');
const source=full.slice(full.indexOf('/* ONYX server-message decoder v1 */'));
const end=source.indexOf('})(window);')+'})(window);'.length;
function decoder(){const logs=[];const c={window:{},console:{info:(...x)=>logs.push(x),warn:(...x)=>logs.push(x)}};vm.createContext(c);vm.runInContext(source.slice(0,end),c);return {read:c.window.ONYXReadServerText,logs};}
for(const prefix of [1,2])test('decodes exact-length UTF16 server text with '+prefix+'-byte length',()=>{
 const text='Verification failed — التحقق';const data=new DataView(new ArrayBuffer(2+prefix+text.length*2));
 data.setUint8(0,41);data.setUint8(1,1);
 if(prefix===2)data.setUint16(2,text.length,true);else data.setUint8(2,text.length);
 for(let i=0;i<text.length;i++)data.setUint16(2+prefix+i*2,text.charCodeAt(i),true);
 const d=decoder(),r={dataView:data,index:2};assert.equal(d.read(r),text);assert.equal(r.index,data.byteLength);assert.equal(d.logs[0][1],text);
});
test('unknown or truncated payload is reported without guessing',()=>{
 const d=decoder(),r={dataView:new DataView(Uint8Array.from([41,1,30,0,65,0]).buffer),index:2};
 assert.equal(d.read(r),'[Server message format not recognized]');assert.equal(r.index,2);
});
