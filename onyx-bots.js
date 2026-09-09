/* Independent bot controls; never replace WebSocket, SC, WASM or game keyboard handlers. */
(function () {
  'use strict';
  if (window.ONYXBots) return;
  const scriptBase = new URL('.', document.currentScript.src);
  const state = {bots: [], generation: 0, paused: false, target: null, host: '', logs: [], spawnWanted: false};
  const host = document.createElement('div'); host.id = 'onyx-bots-panel';
  Object.assign(host.style, {position:'fixed', right:'16px', top:'70px', zIndex:'100000', maxWidth:'calc(100vw - 24px)'});
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
  :host{font:12px Arial,sans-serif;color:#c8cbce}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit;background:#101214;border:1px solid #303438;border-radius:4px;min-height:34px;padding:8px}button{cursor:pointer}button:hover{background:#252a30;border-color:#6a7480}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #7dd3fc}button:disabled{opacity:.4;cursor:default}section{width:380px;max-width:calc(100vw - 24px);background:#0a0c0eed;border:1px solid #303438;border-radius:8px;box-shadow:0 12px 45px #0009;overflow:hidden}header{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #272b30}header strong{flex:1;font-size:13px}header small{color:#929ba4;font-size:10px}main{padding:12px;max-height:calc(100vh - 155px);overflow:auto}nav,.row,.actions{display:flex;gap:8px;margin-bottom:12px}nav button{flex:1;font-size:10px}nav button[aria-selected=true]{border-color:#8294a8}label{display:block;color:#909aa5;font-size:10px;line-height:1.5}label input:not([type=checkbox]),label select{width:100%;display:block;margin-top:4px}label.grow{flex:1}.count{width:72px}.checks{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.checks label{display:flex;align-items:center;gap:5px}input[type=checkbox]{min-height:0;accent-color:#b1c6d9}.actions button{flex:1}footer{border:1px solid #282c30;border-radius:4px;padding:9px;color:#93a3b4;overflow-wrap:anywhere}.hint{font-size:11px;color:#9ba6b1;line-height:1.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px monospace;max-height:350px;overflow:auto}.bot{padding:10px 0;border-bottom:1px solid #292e33} [hidden]{display:none!important}
  </style><section><header><strong>🤖 GAME BOTS</strong><small id="counts">0 total | 0 ready | 0 alive</small><button id="collapse" aria-label="Collapse panel">−</button></header><main>
  <nav><button data-tab="controls" aria-selected="true">CONTROLS</button><button data-tab="active">ACTIVE BOTS</button><button data-tab="console">CONSOLE</button></nav>
  <div id="controls"><div class="row"><label class="grow">NAME<input id="name" maxlength="24" value="Bot"></label><label class="count">COUNT<input id="count" type="number" min="1" max="5" value="2"></label></div>
  <label>SERVER · SAME AS GAME<input id="server" readonly></label><p class="hint">DUAL · FFA · MEGASPLIT<br>Count = connections. DUAL slots come from the server.</p>
  <div class="row"><label class="grow">TARGET<select id="target"><option value="mouse">Mouse</option><option value="hold">Hold current point</option></select></label></div>
  <label>PANEL OPACITY<input id="opacity" type="range" min="35" max="100" value="100"></label>
  <div class="row"><label class="grow">SPAWN KEY<input id="spawnKey" readonly placeholder="Click to bind"></label><label class="grow">SPLIT KEY<input id="splitKey" readonly placeholder="Click to bind"></label><label class="grow">MASS KEY<input id="feedKey" readonly placeholder="Click to bind"></label></div>
  <div class="actions"><button id="connect">⚡ Connect</button><button id="spawn">▶ Spawn</button><button id="split">✂ Split</button><button id="feed">● Mass</button></div>
  <div class="checks"><label><input id="auto" type="checkbox">AUTO SPAWN</label><label><input id="respawn" type="checkbox">RESPAWN</label><label><input id="follow" type="checkbox" checked>FOLLOW</label></div>
  <div class="actions"><button id="pause">Ⅱ Pause</button><button id="stop">■ Stop All</button></div></div>
  <div id="active" hidden></div><div id="console" hidden><button id="copy">Copy diagnostics</button><pre id="log"></pre></div>
  <footer id="status">Ready — select a server and press Connect.</footer></main></section>`;
  const $ = id => root.getElementById(id), keys = {};
  function log(message) {
    state.logs.push(new Date().toLocaleTimeString() + ' ' + message); state.logs = state.logs.slice(-100);
    $('log').textContent = state.logs.join('\n'); $('status').textContent = message;
  }
  function selected() { const el = document.getElementById('servers'); return window.ONYXServers && window.ONYXServers.find(el && el.value); }
  function render() {
    $('counts').textContent = `${state.bots.length} total | ${state.bots.filter(b=>b.ready).length} ready | ${state.bots.reduce((n,b)=>n+b.alive.length,0)} alive`;
    $('active').replaceChildren(...state.bots.map(b => { const el = document.createElement('div'); el.className='bot'; el.textContent=`${b.name} · ${b.status} · ${b.alive.length}/${b.slots} slots alive`; return el; }));
    for (const id of ['spawn','split','feed']) $(id).disabled = state.paused || !state.bots.some(b=>b.ready);
    $('connect').disabled = state.bots.some(b=>b.worker);
  }
  function dispose(b, reason) {
    clearTimeout(b.timer); clearTimeout(b.respawnTimer); clearTimeout(b.spawnTimer);
    if (b.worker) { b.worker.postMessage({type:'close'}); b.worker.terminate(); b.worker=null; }
    b.ready=false; b.alive=[]; b.status=reason; render();
  }
  function stop(reason='Stopped') { state.generation++; state.bots.forEach(b=>dispose(b,reason)); state.spawnWanted=false; state.paused=false; $('pause').textContent='Ⅱ Pause'; render(); log(reason); }
  function spawnBot(b) {
    if (!b.ready || !b.worker || state.paused || b.spawnTimer || b.alive.length === b.slots) return;
    b.worker.postMessage({type:'move',...(state.target || {x:(b.border/2)|0,y:(b.border/2)|0})});
    b.worker.postMessage({type:'spawn'}); b.status='Waiting for own cells';
    b.spawnTimer=setTimeout(()=>{ b.spawnTimer=null; if(b.alive.length<b.slots) { log(b.name+': spawn not confirmed after 8s; reconnect to retry.'); b.status='Spawn unconfirmed'; render(); } },8000);
  }
  function action(type) {
    if (state.paused) return;
    if(type==='spawn') state.spawnWanted=true;
    state.bots.forEach(b=>{if(b.worker&&b.ready) {if(type==='spawn') spawnBot(b); else b.worker.postMessage({type});}});
  }
  function launch(b, entry, generation) {
    if(generation!==state.generation) return;
    let worker;
    try { worker = new Worker(new URL('ffa/onyx-bot-worker.js',scriptBase)); } catch(e) { dispose(b,'Worker failed'); log(e.message); return; }
    b.worker=worker; b.status='Loading codec';
    b.timer=setTimeout(()=>{dispose(b,'Connection timeout');log(b.name+': no ready handshake after 15s.');},15000);
    worker.onerror=()=>{dispose(b,'Worker error');log(b.name+': worker/codec could not load.');};
    worker.onmessage=event=>{
      if(generation!==state.generation || b.worker!==worker) return;
      const m=event.data;
      if(m.type==='codec-ready') { b.status='Connecting'; worker.postMessage({type:'connect',url:window.ONYXFfaAdapter.wsUrl(entry.host),name:b.name,token:window.ONYXFfaAdapter.readJwt()}); }
      if(m.type==='open') b.status='Authenticating';
      if(m.type==='ready') {clearTimeout(b.timer);b.ready=true;b.slots=m.slots;b.border=m.border;b.status='Ready';log(b.name+': ready, '+m.slots+' player slots.');if($('auto').checked||state.spawnWanted) spawnBot(b);}
      if(m.type==='world') {
        const previous=b.status+':'+b.alive.join(',');
        b.alive=m.alive;
        if(b.alive.length===b.slots){clearTimeout(b.spawnTimer);b.spawnTimer=null;}
        b.status=b.alive.length?'Alive':b.spawnTimer?'Spawning':'Ready';
        if(m.died.length && $('respawn').checked && !state.paused && !b.respawnTimer) b.respawnTimer=setTimeout(()=>{b.respawnTimer=null;spawnBot(b);},1500);
        if(previous===b.status+':'+b.alive.join(','))return;
      }
      if(m.type==='blocked'||m.type==='error'||m.type==='close') {const reason=m.reason||m.msg||('Closed '+m.code);dispose(b,reason);log(b.name+': '+reason);}
      render();
    }; render();
  }
  $('connect').onclick=()=>{
    const entry=selected(); if(!entry || !window.ONYXFfaAdapter) return log('Select a supported game server first.');
    stop('Starting '+entry.mode_name); state.bots=[];state.host=entry.host;state.target=null;
    const count=Math.min(5,Math.max(1,Math.trunc(Number($('count').value)||1)));$('count').value=count;
    const generation=state.generation;
    for(let i=0;i<count;i++) {const b={name:($('name').value.trim()||'Bot')+' '+(i+1),ready:false,slots:0,alive:[],status:'Queued',worker:null};state.bots.push(b);b.timer=setTimeout(()=>launch(b,entry,generation),i*800);}
    render();
  };
  for(const id of ['spawn','split','feed']) $(id).onclick=()=>action(id);
  $('stop').onclick=()=>stop();
  $('pause').onclick=()=>{state.paused=!state.paused;$('pause').textContent=state.paused?'▶ Resume':'Ⅱ Pause';log(state.paused?'Paused controls; connections remain open.':'Controls resumed.');render();};
  $('collapse').onclick=()=>{const main=root.querySelector('main');main.hidden=!main.hidden;$('collapse').textContent=main.hidden?'+':'−';};
  $('opacity').oninput=()=>host.style.opacity=Number($('opacity').value)/100;
  root.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{for(const id of ['controls','active','console']) $(id).hidden=id!==btn.dataset.tab;root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===btn)));});
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(state.logs.join('\n'));$('copy').textContent='Copied';}catch(_){log('Copy unavailable; select the console text.');}};
  for(const id of ['spawn','split','feed']) {
    $(id+'Key').onkeydown=e=>{e.preventDefault();e.stopPropagation(); if(['Tab','ShiftLeft','ShiftRight','ControlLeft','AltLeft','MetaLeft'].includes(e.code))return;
      if(e.code==='Escape'||e.code==='Backspace'||e.code==='Delete'){delete keys[id];$(id+'Key').value='';return;}
      for(const other of Object.keys(keys))if(keys[other]===e.code){delete keys[other];$(other+'Key').value='';}
      keys[id]=e.code;$(id+'Key').value=e.code;
    };
  }
  window.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.composedPath().includes(host)||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;
    const id=Object.keys(keys).find(k=>keys[k]===e.code);if(id)action(id);
  });
  // Shadow retargeting keeps game shortcuts out of panel inputs.
  for(const type of ['keydown','keyup','mousedown','mouseup','wheel']) root.addEventListener(type,e=>e.stopPropagation());
  let ticks=0;
  const timer=setInterval(()=>{
    const entry=selected();$('server').value=entry?entry.mode_name+' · '+entry.host:'No supported server';
    if(state.bots.some(b=>b.worker||b.status==='Queued') && (!entry||entry.host!==state.host))stop('Server changed — reconnect bots.');
    ticks++;
    state.bots.forEach(b=>{if(!b.worker||!b.ready)return;if(ticks%10===0)b.worker.postMessage({type:'ping'});
      if(!state.paused&&$('follow').checked&&state.target)b.worker.postMessage({type:'move',...state.target});});
  },100);
  window.addEventListener('pagehide',()=>{clearInterval(timer);stop();},{once:true});
  window.ONYXBots={stop,observePacket(buffer){
    if($('target').value==='hold'&&state.target)return;
    const b=buffer instanceof ArrayBuffer?new Uint8Array(buffer):ArrayBuffer.isView(buffer)?new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength):null;
    if(!b||b[0]!==20||b[1]!==0||b.length!==11)return;
    const v=new DataView(b.buffer,b.byteOffset,b.byteLength);state.target={x:v.getInt32(3,true),y:v.getInt32(7,true)};
  }};
  document.body.appendChild(host);render();
})();
