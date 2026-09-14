/* Independent bot controls; never replace WebSocket, SC, WASM or game keyboard handlers. */
(function () {
  'use strict';
  if (window.ONYXBots) return;
  const scriptBase = new URL(window.__KATERONYX_BASE_URL || '.', document.baseURI);
  const state = {bots: [], generation: 0, paused: false, target: null, host: '', logs: [], spawnWanted: false};
  const host = document.createElement('div'); host.id = 'onyx-bots-panel';
  Object.assign(host.style, {position:'fixed', right:'16px', top:'70px', zIndex:'100000', maxWidth:'calc(100vw - 24px)'});
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
  :host{font:12px Arial,sans-serif;color:#c8cbce}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit;background:#101214;border:1px solid #303438;border-radius:4px;min-height:34px;padding:8px}button{cursor:pointer}button:hover{background:#252a30;border-color:#6a7480}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #7dd3fc}button:disabled{opacity:.4;cursor:default}section{width:380px;max-width:calc(100vw - 24px);background:#0a0c0eed;border:1px solid #303438;border-radius:8px;box-shadow:0 12px 45px #0009;overflow:hidden}header{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #272b30}header strong{flex:1;font-size:13px}header small{color:#929ba4;font-size:10px}main{padding:12px;max-height:calc(100vh - 155px);overflow:auto}nav,.row,.actions{display:flex;gap:8px;margin-bottom:12px}nav button{flex:1;font-size:10px}nav button[aria-selected=true]{border-color:#8294a8}label{display:block;color:#909aa5;font-size:10px;line-height:1.5}label input:not([type=checkbox]),label select{width:100%;display:block;margin-top:4px}label.grow{flex:1}.count{width:72px}.checks{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.checks label{display:flex;align-items:center;gap:5px}input[type=checkbox]{min-height:0;accent-color:#b1c6d9}.actions button{flex:1}footer{border:1px solid #282c30;border-radius:4px;padding:9px;color:#93a3b4;overflow-wrap:anywhere}.hint{font-size:11px;color:#9ba6b1;line-height:1.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px monospace;max-height:350px;overflow:auto}.bot{padding:10px 0;border-bottom:1px solid #292e33} [hidden]{display:none!important}
  </style><section><header><strong>🤖 GAME BOTS · 2.1.6</strong><small id="counts">0 total | 0 ready | 0 alive</small><button id="collapse" aria-label="Collapse panel">−</button></header><main>
  <nav><button data-tab="controls" aria-selected="true">CONTROLS</button><button data-tab="active">ACTIVE BOTS</button><button data-tab="console">CONSOLE</button></nav>
  <div id="controls"><div class="row"><label class="grow">NAME<input id="name" maxlength="24" value="Bot"></label><label class="count">COUNT<input id="count" type="number" min="1" max="100" value="2"></label></div>
  <label>SERVER · SAME AS GAME<input id="server" readonly></label><p class="hint">DUAL · FFA · MEGASPLIT<br>Count = bot players (2 means 2, including on DUAL).<br>For player multibox only: use PLAY and Tab; leave bots disconnected.</p>
  <div class="row"><label class="grow">TARGET<select id="target"><option value="player">Follow me · اتجمع عندي</option><option value="mouse">Mouse · الماوس</option><option value="hold">Hold current point</option></select></label></div>
  <p class="hint">Z: Spawn · X: Split · hold C: Mass<br>Follow me gathers bots after spawn. The server chooses spawn locations.<br>100 maximum requested; connections start one per second.</p><p id="targetStatus" class="hint"></p><label>PANEL OPACITY<input id="opacity" type="range" min="35" max="100" value="100"></label>
  <div class="row"><label class="grow">SPAWN KEY<input id="spawnKey" readonly placeholder="Click to bind"></label><label class="grow">SPLIT KEY<input id="splitKey" readonly placeholder="Click to bind"></label><label class="grow">MASS KEY<input id="feedKey" readonly placeholder="Click to bind"></label></div>
  <div class="actions"><button id="connect">⚡ Connect</button><button id="spawn">▶ Spawn</button><button id="split">✂ Split</button><button id="feed">● Mass</button></div>
  <div class="checks"><label><input id="auto" type="checkbox" checked>AUTO SPAWN</label><label><input id="autoFeed" type="checkbox" checked>AUTO FEED</label><label><input id="respawn" type="checkbox">RESPAWN</label><label><input id="follow" type="checkbox" checked>FOLLOW</label></div>
  <div class="actions"><button id="pause">Ⅱ Pause</button><button id="stop">■ Stop All</button></div></div>
  <div id="active" hidden></div><div id="console" hidden><button id="copy">Copy diagnostics</button><pre id="log"></pre></div>
  <footer id="status">Ready — select a server and press Connect.</footer></main></section>`;
  const $ = id => root.getElementById(id), keys = {spawn:'KeyZ',split:'KeyX',feed:'KeyC'};
  let feeding=false;
  for(const id of Object.keys(keys)) $(id+'Key').value=keys[id];
  function log(message) {
    state.logs.push(new Date().toLocaleTimeString() + ' ' + message); state.logs = state.logs.slice(-100);
    $('log').textContent = state.logs.join('\n'); $('status').textContent = message;
  }
  function selected() { const el = document.getElementById('servers'); return window.ONYXServers && window.ONYXServers.find(el && el.value); }
  function target() {
    if($('target').value==='hold') return state.target;
    const api=window.ONYXBotGame;
    const value=api&&api.target($('target').value);
    state.target=value&&Number.isFinite(value.x)&&Number.isFinite(value.y)?value:null;
    return state.target;
  }
  function aim(b) {
    const point=target();
    if(point&&b.worker&&b.ready)b.worker.postMessage({type:'move',...point});
    return point;
  }
  function render() {
    $('counts').textContent = `${state.bots.length} total | ${state.bots.filter(b=>b.ready).length} ready | ${state.bots.reduce((n,b)=>n+b.alive.length,0)} alive`;
    $('active').replaceChildren(...state.bots.map(b => { const el = document.createElement('div'); el.className='bot'; el.textContent=`${b.name} · ${b.status} · ${b.alive.length}/${b.slots} slots alive`; return el; }));
    for (const id of ['spawn','split','feed']) $(id).disabled = state.paused || !state.bots.some(b=>b.ready);
    $('connect').disabled = state.bots.some(b=>b.worker||b.status==='Queued');
  }
  function dispose(b, reason) {
    clearTimeout(b.timer); clearTimeout(b.respawnTimer); clearTimeout(b.spawnTimer);
    if (b.worker) { b.worker.postMessage({type:'close'}); b.worker.terminate(); b.worker=null; }
    b.ready=false; b.alive=[]; b.status=reason; render();
  }
  function stop(reason='Stopped') { feeding=false;state.generation++; state.bots.forEach(b=>dispose(b,reason)); state.spawnWanted=false; state.paused=false; $('pause').textContent='Ⅱ Pause'; render(); log(reason); }
  function spawnBot(b) {
    if (!b.ready || !b.worker || state.paused || b.spawnTimer || b.respawnTimer || b.alive.length === b.slots) return;
    aim(b);
    b.worker.postMessage({type:'spawn'}); b.status='Waiting for own cells';
    b.spawnTimer=setTimeout(()=>{ b.spawnTimer=null; if(b.alive.length<b.slots) { log(b.name+': spawn not confirmed after 8s; Auto Spawn retries while enabled.'); b.status='Spawn unconfirmed'; render(); } },8000);
  }
  function action(type) {
    if (state.paused) return;
    if(type==='spawn') state.spawnWanted=true;
    if(type!=='spawn'&&!state.bots.some(b=>b.alive.length)) return log('No confirmed live bots yet. Wait for alive after Spawn.');
    state.bots.forEach(b=>{if(b.worker&&b.ready) {if(type==='spawn') spawnBot(b); else if(b.alive.length) {aim(b);b.worker.postMessage({type});}}});
  }
  function launch(b, entry, generation) {
    if(generation!==state.generation) return;
    let worker;
    try { worker = window.ONYXCreateBotCodec(); } catch(e) { dispose(b,'Codec failed'); log(e.message); return; }
    b.worker=worker; b.status='Loading codec';
    b.timer=setTimeout(()=>{const phase=b.status;const removed=b.worker&&b.worker.isAttached&&!b.worker.isAttached();dispose(b,'Connection timeout');log(b.name+': '+(removed?'Codec frame was removed.': 'Timeout during '+phase+' after 15s.'));},15000);
    worker.onerror=e=>{dispose(b,'Codec error');log(b.name+': '+(e.message||'codec could not load.'));};
    worker.onmessage=event=>{
      if(generation!==state.generation || b.worker!==worker) return;
      const m=event.data;
      if(m.type==='log') log(b.name+': '+m.msg);
      if(m.type==='codec-ready') { log(b.name+': WASM ready; opening game connection.');b.status='Connecting'; worker.postMessage({type:'connect',url:window.ONYXFfaAdapter.wsUrl(entry.host),name:b.name,token:window.ONYXFfaAdapter.readJwt(),tag:window.ONYXBotGame?window.ONYXBotGame.tag():''}); }
      if(m.type==='open') {b.status='Authenticating';log(b.name+': WebSocket open; waiting for server handshake.');}
      if(m.type==='ready') {clearTimeout(b.timer);b.ready=true;b.slots=m.slots;b.border=m.border;b.status='Ready';log(b.name+': ready, '+m.slots+' bot player; server assigned '+(m.assignedSlots||m.slots)+' slots.');if($('auto').checked||state.spawnWanted) spawnBot(b);}
      if(m.type==='world') {
        const previous=b.status+':'+b.alive.join(',');
        b.alive=m.alive;
        if(b.alive.length&&$('follow').checked&&!state.paused)aim(b);
        if(b.alive.length===b.slots){clearTimeout(b.spawnTimer);b.spawnTimer=null;}
        b.status=b.alive.length?'Alive':b.spawnTimer?'Spawning':'Ready';
        if(m.died.length && ($('auto').checked || $('respawn').checked) && !state.paused && !b.respawnTimer) b.respawnTimer=setTimeout(()=>{b.respawnTimer=null;if($('auto').checked||$('respawn').checked)spawnBot(b);},1500);
        if(previous===b.status+':'+b.alive.join(','))return;
      }
      if(m.type==='blocked'||m.type==='error'||m.type==='close') {const reason=m.reason||m.msg||('Closed '+m.code);dispose(b,reason);log(b.name+': '+reason);}
      render();
    }; render();
  }
  $('connect').onclick=()=>{
    const entry=selected(); if(!entry || !window.ONYXFfaAdapter) return log('Select a supported game server first.');
    stop('Starting '+entry.mode_name); state.bots=[];state.host=entry.host;state.target=null;
    const count=Math.min(100,Math.max(1,Math.trunc(Number($('count').value)||1)));$('count').value=count;
    const generation=state.generation;
    for(let i=0;i<count;i++) {const b={name:($('name').value.trim()||'Bot')+' '+(i+1),ready:false,slots:0,alive:[],status:'Queued',worker:null};state.bots.push(b);b.timer=setTimeout(()=>launch(b,entry,generation),i*1000);}
    render();
  };
  for(const id of ['spawn','split','feed']) $(id).onclick=()=>action(id);
  $('auto').onchange=()=>{if($('auto').checked)state.bots.forEach(spawnBot);};
  $('stop').onclick=()=>stop();
  $('pause').onclick=()=>{feeding=false;state.paused=!state.paused;$('pause').textContent=state.paused?'▶ Resume':'Ⅱ Pause';log(state.paused?'Paused controls; connections remain open.':'Controls resumed.');render();};
  $('collapse').onclick=()=>{const main=root.querySelector('main');main.hidden=!main.hidden;$('collapse').textContent=main.hidden?'+':'−';};
  $('opacity').oninput=()=>host.style.opacity=Number($('opacity').value)/100;
  root.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{for(const id of ['controls','active','console']) $(id).hidden=id!==btn.dataset.tab;root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===btn)));});
  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(state.logs.join('\n'));$('copy').textContent='Copied';}catch(_){log('Copy unavailable; select the console text.');}};
  for(const id of ['spawn','split','feed']) {
    $(id+'Key').onkeydown=e=>{e.preventDefault();e.stopPropagation(); if(['Tab','ShiftLeft','ShiftRight','ControlLeft','AltLeft','MetaLeft','KeyP'].includes(e.code))return;
      if(e.code==='Escape'||e.code==='Backspace'||e.code==='Delete'){delete keys[id];$(id+'Key').value='';return;}
      for(const other of Object.keys(keys))if(keys[other]===e.code){delete keys[other];$(other+'Key').value='';}
      keys[id]=e.code;$(id+'Key').value=e.code;
    };
  }
  function typing(e){return e.composedPath().some(el=>el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));}
  window.addEventListener('keydown',e=>{
    if(e.ctrlKey||e.metaKey||e.altKey||typing(e)||e.composedPath().includes(host)||state.paused)return;
    const id=Object.keys(keys).find(k=>keys[k]===e.code);
    if(!id||!state.bots.some(b=>b.ready))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(e.repeat)return;
    if(id==='feed')feeding=true;
    action(id);
  },true);
  window.addEventListener('keyup',e=>{if(e.code===keys.feed)feeding=false;},true);
  window.addEventListener('blur',()=>{feeding=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)feeding=false;});
  $('target').onchange=()=>{if($('target').value!=='hold')state.target=null;target();};
  $('follow').onchange=()=>{if(!$('follow').checked)feeding=false;};
  // Shadow retargeting keeps game shortcuts out of panel inputs.
  for(const type of ['keydown','keyup','mousedown','mouseup','wheel']) root.addEventListener(type,e=>e.stopPropagation());
  let ticks=0;
  const timer=setInterval(()=>{
    const entry=selected();$('server').value=entry?entry.mode_name+' · '+entry.host:'No supported server';
    if(state.bots.some(b=>b.worker||b.status==='Queued') && (!entry||entry.host!==state.host))stop('Server changed — reconnect bots.');
    ticks++;
    const point=target();
    $('targetStatus').textContent=point?('Target: '+Math.round(point.x)+', '+Math.round(point.y)):'Waiting for your player position — enter PLAY and update the hosted files.';
    if((feeding||$('autoFeed').checked)&&!state.paused&&state.bots.some(b=>b.ready&&b.alive.length))action('feed');
    state.bots.forEach(b=>{if(!b.worker||!b.ready)return;if(ticks%10===0)b.worker.postMessage({type:'ping'});
      if(!state.paused&&$('auto').checked)spawnBot(b);
      if(!state.paused&&$('follow').checked&&point)b.worker.postMessage({type:'move',...point});});
  },100);
  window.addEventListener('pagehide',()=>{clearInterval(timer);stop();},{once:true});
  window.ONYXBots={stop,observePacket(){ /* Targets come from the active game's coordinate transform. */ }};

  document.body.appendChild(host);render();
})();
