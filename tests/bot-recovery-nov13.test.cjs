'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{panel,saved,jwt}=require('./helpers/bot-panel.cjs'),{Protocol}=require('../ffa/onyx-bot-protocol.js');
async function accountFixture(){const p=panel(saved(true));await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();const w=p.workers[0];w.onmessage({data:{type:'codec-ready'}});return{p,w};}
const receive=(w,type,data={})=>w.onmessage({data:{type,...data}});
test('reverification suspends ready controls and a fresh four-slot greeting replaces stale two-slot metadata',async()=>{
 const {p,w}=await accountFixture(),requests=[];p.c.ONYXVerification={request:r=>requests.push(r),complete(){},cancel(){}};
 receive(w,'ready',{slots:2,assignedSlots:2,border:20000});receive(w,'world',{alive:[0,1],died:[]});receive(w,'verification-required',{requestId:2,challengeType:1});
 assert.equal(p.ids.spawn.disabled,true);assert.match(p.ids.counts.textContent,/0 ready/);const n=w.sent.length;p.intervals[0]();assert.equal(w.sent.length,n);assert.equal(requests.length,1);
 receive(w,'ready',{slots:4,assignedSlots:4,border:24000});assert.match(p.ids.counts.textContent,/4 ready/);assert.match(p.ids['account-status-1'].textContent,/4\/4 players allocated/);assert.equal([...p.timers.values()].filter(t=>t.ms===1000).length,0);assert.equal(p.primaryReads,0);assert(w.sent.some(m=>m.type==='spawn'));
});
test('a repeated four-slot greeting cannot expand an account already using a second two-slot connection',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:2,assignedSlots:2});const extra=p.start(2);receive(w,'ready',{slots:4,assignedSlots:4});
 assert.deepEqual(JSON.parse(JSON.stringify(w.sent.find(m=>m.type==='slot-limit'))),{type:'slot-limit',limit:2});assert.match(p.ids['account-status-1'].textContent,/4\/4 players allocated/);assert.equal(extra.closed,undefined);assert.equal(p.workers.length,2);
});
test('a failed second connection remains visible and manual completion preserves the first connection and its bot-only token',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:2,assignedSlots:2});const second=p.start(2);receive(second,'close',{code:4406,reason:'Session rejected'});
 assert.match(p.ids['account-status-1'].textContent,/PARTIAL/);assert.match(p.ids['account-status-1'].textContent,/Session rejected/);assert.equal(p.ids['account-connect-1'].disabled,false);assert.equal(p.ids['account-connect-1'].textContent,'Complete 2 players');assert.equal(w.closed,undefined);
 const count=p.workers.length;p.intervals[0]();assert.equal(p.workers.length,count);p.ids['account-connect-1'].onclick();const retry=p.workers.at(-1);receive(retry,'codec-ready');assert.equal(retry.sent.find(m=>m.type==='connect').token,jwt);assert.equal(retry.sent.find(m=>m.type==='connect').slotLimit,2);receive(retry,'ready',{slots:2,assignedSlots:2});assert.match(p.ids['account-status-1'].textContent,/READY/);assert.match(p.ids.counts.textContent,/4 ready/);assert.equal(p.primaryReads,0);assert.equal(w.closed,undefined);
});
test('a new verification on an account does not erase or disconnect another bot account',async()=>{
 const data=saved(),rows=JSON.parse(data.get('onyx:eu-facebook-bots:v1'));rows.push({...rows[0],id:2});data.set('onyx:eu-facebook-bots:v1',JSON.stringify(rows));const p=panel(data);await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();const first=p.workers[0];receive(first,'ready',{slots:4});p.advance(1001);p.intervals[0]();const second=p.workers[1];receive(second,'codec-ready');receive(second,'ready',{slots:4});p.c.ONYXVerification={request(){},complete(){},cancel(){}};receive(first,'verification-required',{requestId:7,challengeType:1});assert.match(p.ids['account-status-2'].textContent,/4\/4 players allocated/);assert.equal(second.closed,undefined);assert.equal(p.primaryReads,0);
});
test('mouse movement over the game drives bots even when the player-follow facade has no living main player',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:4});p.setPoint(null);(p.events.mousemove||[]).forEach(fn=>fn({target:{tagName:'CANVAS'},clientX:150,clientY:250}));receive(w,'world',{alive:[0,1,2,3],died:[]});p.intervals[0]();const move=w.sent.filter(m=>m.type==='move').at(-1);assert.equal(move.x,300);assert.equal(move.y,750);
 p.ids.follow.checked=false;const count=w.sent.filter(m=>m.type==='move').length;p.intervals[0]();assert.equal(w.sent.filter(m=>m.type==='move').length,count);p.ids.follow.checked=true;p.ids.pause.onclick();p.intervals[0]();assert.equal(w.sent.filter(m=>m.type==='move').length,count);
});
test('closing a bot account cancels pending controls and ignores stale verification/readiness messages',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:2});p.ids['account-disconnect-1'].onclick();assert(w.closed);receive(w,'ready',{slots:4});assert.match(p.ids['account-status-1'].textContent,/0\/4 players allocated/);assert.equal(p.timers.size,0);assert.equal(p.primaryReads,0);
});
test('account-specific Spawn missing targets only that account and reports ready separately from living players',async()=>{
 const p=panel(saved(false));await p.c.ONYXBotAccounts.ready;await Promise.resolve();p.intervals[0]();const first=p.workers[0];receive(first,'codec-ready');receive(first,'ready',{slots:2});const second=p.start(2);receive(first,'world',{alive:[0,1],died:[]});
 assert.match(p.ids['account-status-1'].textContent,/PARTIAL LIVE/);assert.equal(p.ids['account-spawn-1'].disabled,false);const sent=first.sent.length;p.ids['account-spawn-1'].onclick();assert(second.sent.some(m=>m.type==='spawn'));assert.equal(first.sent.length,sent);receive(second,'world',{alive:[0,1],died:[]});assert.match(p.ids['account-status-1'].textContent,/ACTIVE/);assert.equal(p.ids['account-spawn-1'].disabled,true);assert.equal(p.primaryReads,0);
});
test('a slot budget can only select granted owners and cannot create extra server-assigned characters',()=>{
 const sent=[],p=new Protocol(b=>sent.push([...b]),()=>{});p.slotLimit=4;const hello=Buffer.alloc(16);hello[7]=4;[300,301,302,303].forEach((id,i)=>hello.writeUInt16LE(id,8+i*2));p.receive(Uint8Array.from(hello).buffer);assert.equal(p.setSlotLimit(2),true);p.move(123,-456);assert.deepEqual(sent.slice(-2).map(b=>b.slice(0,3)),[[20,0,0],[20,0,1]]);assert.equal(p.setSlotLimit(0),false);assert.equal(p.setSlotLimit(100),true);assert.equal(p.ids.length,4);
});
test('ADD COUNT connections cannot exceed their requested total on a later greeting',()=>{
 const p=panel();p.ids.count.value='4';p.ids.connect.onclick();const first=p.start(2),second=p.start(2);receive(first,'ready',{slots:4,assignedSlots:4});assert.match(p.ids.counts.textContent,/4 allocated.*4 ready/);assert.equal(first.sent.find(m=>m.type==='slot-limit').limit,2);assert.equal(second.closed,undefined);
});
test('late world events cannot report owners outside the accepted slot budget as living players',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:2});receive(w,'world',{alive:[0,1,2,2,-1],died:[]});assert.match(p.ids.counts.textContent,/2 alive/);assert.match(p.ids['account-status-1'].textContent,/2 alive/);
});
test('diagnostics expose allocation and rejection states without bot tokens or primary login data',async()=>{
 const {p,w}=await accountFixture();receive(w,'ready',{slots:2,assignedSlots:2});const data=JSON.parse(JSON.stringify(p.c.ONYXBots.diagnostics())),text=JSON.stringify(data);assert.equal(data.connections[0].assigned,2);assert.equal(data.connections[0].controlled,2);assert.equal(data.connections[0].account,1);assert(!text.includes(jwt));assert(!text.includes('primary-must-not-be-used'));assert.equal(p.primaryReads,0);
});
