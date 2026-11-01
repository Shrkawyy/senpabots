const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../deo.onyx.beautified.js'),'utf8');
const key=source.indexOf("'key': 'displayTurnstile'"),start=source.indexOf('function (',key),end=source.indexOf('\n                    }]), _0x37d395;',start);
const names={0x7ce:'verifyUser',0x619:'overlay',0x318:'show',0x90a:'siteKey',0x4bc:'sendCaptcha',0x530:'hide'};
for(const type of [1,2])test('engine passes requested type '+type+' and captured tab to official lifecycle',()=>{
 let options;const sent=[];
 const c={_0x400f:id=>names[id],document:{getElementById:()=>({})},turnstile:{},window:{ONYXVerification:{show:o=>{options=o;}}},_0x446f71:{sendCaptcha:(...x)=>sent.push(x)}};
 vm.createContext(c);const show=vm.runInContext('('+source.slice(start,end).trim()+')',c);
 show.call({siteKey:'key',overlay:{show(){},hide(){}}},type,2);
 assert.equal(options.type,type);assert.equal(options.tab,2);options.send(type,'result',2);assert.deepEqual(sent,[[type,'result',2]]);
});
