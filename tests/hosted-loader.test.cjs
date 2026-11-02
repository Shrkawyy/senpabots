const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../kateronyx.user.js'),'utf8');
const base='https://senpabots.vercel.app/';

test('hosted release ignores saved local trial addresses and updates from the hosted script',()=>{
  const start=source.indexOf('  function getBaseUrl()'),end=source.indexOf('\n  function srcOf(',start);
  const getBase=vm.runInNewContext('('+source.slice(start,end)+')',{DEFAULT_BASE_URL:base,localStorage:{getItem(){throw Error('Old local settings must not be read');}}});
  assert.equal(getBase(),base);
  assert.match(source,/var DEFAULT_BASE_URL = 'https:\/\/senpabots\.vercel\.app\/'/);
  assert.match(source,/\/\/ @updateURL\s+https:\/\/senpabots\.vercel\.app\/kateronyx\.meta\.js/);
  assert.match(source,/\/\/ @downloadURL\s+https:\/\/senpabots\.vercel\.app\/kateronyx\.user\.js/);
  assert.match(source,/\/\/ @connect\s+senpabots\.vercel\.app/);
  assert(!source.includes('127.0.0.1:3020'));
});

test('load-error recovery points to the hosted script without asking players to start localhost',()=>{
  const start=source.indexOf('  function renderError('),end=source.indexOf('\n  function gmGet(',start);
  const elements=[];
  const document={createElement(tagName){const node={tagName,style:{},append(){},appendChild(){},addEventListener(){}};elements.push(node);return node;},documentElement:{replaceChildren(){}}};
  const render=vm.runInNewContext('('+source.slice(start,end)+')',{document,window:{stop(){}},DEFAULT_BASE_URL:base,URL,location:{reload(){}}});
  render('HTTP 404');
  assert.equal(elements.find(node=>node.tagName==='a').href,base+'kateronyx.user.js');
  assert(elements.some(node=>node.textContent?.includes(base)));
  assert(elements.every(node=>!String(node.textContent||node.innerHTML||'').includes('127.0.0.1')));
});

test('simultaneous stylesheet failures are consumed by the main loader rejection',async()=>{
  const start=source.indexOf('    var styleAndLibraries ='),end=source.indexOf('    var fontBlob =',start);
  const requests=[];
  const context={Promise,Error,encodeURIComponent,baseUrl:base,v:'2.6.4',LOCAL_CSS:['a.css','b.css','c.css'],CDN_SCRIPTS:[['https://cdn.example/lib.js','lib.js']],gmGet(url){requests.push(url);return Promise.reject(Error('fixture unavailable'));}};
  const load=vm.runInNewContext('(async function(){'+source.slice(start,end)+'})',context);
  await assert.rejects(load(),/fixture unavailable/);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,4);
  assert(requests.every(url=>url.startsWith('https://')));
});
