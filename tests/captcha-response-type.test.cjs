const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../deo.onyx.beautified.js'),'utf8');
const key=source.indexOf("'key': 'displayTurnstile'");
const start=source.indexOf('function (',key);
const end=source.indexOf('\n                    }]), _0x37d395;',start);
const fnSource=source.slice(start,end).trim();
const names={0x7ce:'verifyUser',0x3ef:'widget',0x619:'overlay',0x318:'show',0x5a6:'inited',0x90a:'siteKey',0x4bc:'sendCaptcha',0x855:'tab',0x530:'hide',0x1d3:'render'};
for(const requestedType of [1,2])test('official response preserves requested type '+requestedType+' and connection',()=>{
 let callback,shown=0,hidden=0;const sent=[];
 const context={_0x400f:id=>names[id],document:{getElementById:()=>({})},
  _0x446f71:{sendCaptcha:(...args)=>sent.push(args)},
  turnstile:{render:(container,options)=>{callback=options.callback;return 'widget-id';}}};
 vm.createContext(context);const display=vm.runInContext('('+fnSource+')',context);
 const state={siteKey:'existing-key',overlay:{show(){shown++;},hide(){hidden++;}}};
 display.call(state,requestedType,2);assert.equal(shown,1);assert.equal(sent.length,0);
 callback('official-widget-result');
 assert.deepEqual(sent,[[requestedType,'official-widget-result',2]]);assert.equal(hidden,1);
});
test('userscript also updates an older hosted engine',()=>{
 const loader=fs.readFileSync(path.join(__dirname,'../kateronyx.user.js'),'utf8');
 const line=loader.split('\n').find(s=>s.includes('deoJs = deoJs.replace('));
 const corrected='_0x446f71[_0x4e8b8b(0x4bc)](_0xba7045, _0x598234, _0xb868d6[_0x4e8b8b(0x855)])';
 const legacy=corrected.replace('](_0xba7045,','](0x2,');
 const context={deoJs:source.replace(corrected,legacy)};vm.createContext(context);vm.runInContext(line,context);
 assert.equal(context.deoJs,source);
});
