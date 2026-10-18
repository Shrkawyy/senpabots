/* Server-provided clients + visible world ownership; absence is not proof of spectating. */
(function(g){
'use strict';
function rows(s){
 if(!s||!s.connected||!s.clients)return [];
 const seen=new Map();
 if(s.cells)s.cells.forEach(c=>{if(c.isRemoved||c.isFood||c.isVirus||c.isEjected)return;const p=s.players&&s.players.get(c.parentPlayerID);if(p&&!seen.has(p.parentClientID))seen.set(p.parentClientID,p.id);});
 return [...s.clients.values()].map(c=>({id:c.id,nick:c.nick||'Unnamed',tag:c.tag||'—',pid:seen.get(c.id),
 status:seen.has(c.id)?'playing':c.isSpectating===true?'spectating':'unknown'})).sort((a,b)=>a.nick.localeCompare(b.nick));
}
g.ONYXSpectateRows=rows;
if(typeof module!=='undefined')module.exports={rows};
if(!g.document||g.ONYXSpectatePanel)return;
const host=document.createElement('div');host.id='onyx-spectate-panel';host.hidden=true;
Object.assign(host.style,{position:'fixed',top:'12vh',left:'50%',transform:'translateX(-50%)',zIndex:'100005',width:'min(680px,94vw)'});
const root=host.attachShadow({mode:'open'});root.innerHTML=`<style>
:host{font:14px Arial;color:#e6edf5}*{box-sizing:border-box}section{background:#101820;border:1px solid #415263;border-radius:12px;padding:18px;box-shadow:0 16px 70px #000b}header{display:flex;justify-content:space-between;align-items:center}button,input,select{background:#1c2935;color:#e6edf5;border:1px solid #526575;border-radius:6px;padding:9px}button{cursor:pointer}button:disabled{opacity:.4;cursor:default}.tools{display:flex;gap:8px;margin:14px 0;flex-wrap:wrap}input{flex:1;min-width:130px}.scroll{max-height:48vh;overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:start;padding:9px;border-bottom:1px solid #2a3a48;overflow-wrap:anywhere}small,p{color:#afbdcb;line-height:1.6}td:first-child{max-width:190px}</style>
<section dir="rtl"><header><strong>Server roster</strong><button id="close">Close ×</button></header>
<div class="tools"><input id="search" placeholder="Search name or tag"><select id="filter"><option value="all">All</option><option value="playing">Playing</option><option value="spectating">Spectating</option><option value="unknown">Unknown</option></select><button id="enter">Enter Spectate</button></div>
<small id="count"></small><div class="scroll"><table><thead><tr><th>Player</th><th>Status</th><th>Tag</th></tr></thead><tbody id="list"></tbody></table></div>
<p id="note">Only server-provided clients are listed. Unknown means the server has not confirmed a status. Missing cells do not prove spectating. Click a visible player to watch.</p><p id="status"></p></section>`;
const $=id=>root.getElementById(id),labels={playing:'Playing',spectating:'Spectating',unknown:'Unknown'};
function refresh(){if(host.hidden)return;const api=g.ONYXSpectateGame,s=api&&api.snapshot(),all=rows(s),q=$('search').value.trim().toLowerCase(),filter=$('filter').value;
 $('count').textContent=s&&s.connected?all.length+' server-reported clients':'Connect to a server to view the roster';
 const filtered=all.filter(r=>(filter==='all'||r.status===filter)&&(r.nick+' '+r.tag).toLowerCase().includes(q));
 $('list').replaceChildren(...filtered.map(r=>{const tr=document.createElement('tr');
 for(const value of [r.nick,labels[r.status],r.tag]){const td=document.createElement('td');td.dir='auto';td.textContent=value;tr.appendChild(td);}
 if(r.pid!==undefined){const button=document.createElement('button');button.textContent=r.nick;button.title='Watch '+r.nick;button.onclick=()=>{$('status').textContent=api.watch(r.pid,r.nick)||'Watching '+r.nick;};tr.children[0].replaceChildren(button);}
 return tr;}));
}
function toggle(){host.hidden=!host.hidden;if(!host.hidden){refresh();}}
$('close').onclick=()=>{host.hidden=true;};$('enter').onclick=()=>{$('status').textContent=g.ONYXSpectateGame?g.ONYXSpectateGame.enter()||'Spectate enabled':'Game is still loading';};$('search').oninput=refresh;$('filter').onchange=refresh;
g.addEventListener('keydown',e=>{const path=e.composedPath();if(e.key==='Escape'&&!host.hidden){host.hidden=true;e.stopImmediatePropagation();return;}if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;if(path.some(el=>el.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))return;if(e.code==='KeyP'){e.preventDefault();e.stopImmediatePropagation();toggle();}},true);
for(const type of ['keydown','keyup','mousedown','mouseup','wheel'])root.addEventListener(type,e=>e.stopPropagation());
document.body.appendChild(host);const timer=setInterval(refresh,1000);g.addEventListener('pagehide',()=>clearInterval(timer),{once:true});g.ONYXSpectatePanel={toggle};
})(typeof window!=='undefined'?window:globalThis);
