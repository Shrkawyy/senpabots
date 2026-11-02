/* Senpa v4 packets, grounded in the bundled client. No renderer or page globals. */
(function (g) {
  'use strict';
  class Reader {
    constructor(buffer) { this.v = new DataView(buffer); this.i = 0; }
    u8() { return this.v.getUint8(this.i++); }
    u16() { const n = this.v.getUint16(this.i, true); this.i += 2; return n; }
    u32() { const n = this.v.getUint32(this.i, true); this.i += 4; return n; }
    i32() { const n = this.v.getInt32(this.i, true); this.i += 4; return n; }
    skip(n) { if (this.i + n > this.v.byteLength) throw Error('Truncated packet'); this.i += n; }
  }
  function stringPacket(op, text, long) {
    text = String(text || '').slice(0, long ? 65535 : 255);
    const b = new Uint8Array(1 + (long ? 2 : 1) + text.length * 2), v = new DataView(b.buffer);
    b[0] = op; if (long) v.setUint16(1, text.length, true); else b[1] = text.length;
    for (let i = 0; i < text.length; i++) v.setUint16(1 + (long ? 2 : 1) + i * 2, text.charCodeAt(i), true);
    return b;
  }
  class Protocol {
    constructor(send, emit, alloc) {
      this.send = send; this.emit = emit; this.alloc = alloc || (() => {});
      this.ready = false; this.ids = []; this.cells = new Map(); this.pending = new Map();
      this.slotLimit = 1; this.spawnRetryMs = 8000; this.received = {};
      this.challenge = null; this.challengeSequence = 0;
      this.lastAlive = []; this.name = 'Bot'; this.tag = ''; this.token = 'null';
    }
    receive(buffer) {
      const r = new Reader(buffer), op = r.u8();
      this.received[op] = (this.received[op] || 0) + 1;
      if (op === 41) {
        const kind=r.u8();
        const longLength=r.v.byteLength>=4 && r.v.getUint16(2,true)*2+4===r.v.byteLength;
        const n=longLength?r.u16():r.u8(); let message="";
        for(let i=0;i<n;i++)message+=String.fromCharCode(r.u16());
        this.emit({type:"log",msg:"Server message ("+kind+"): "+message});
      }
      if (op === 8) this.send(stringPacket(13, this.token, true));
      if (op === 7) {
        const loggedUsersOnly=r.u8(),version=r.u8(),challengeType=1;this.ready=false;
        this.challenge={id:++this.challengeSequence,version,loggedUsersOnly,type:challengeType,submitted:false};
        this.emit({type:'verification-required',requestId:this.challenge.id,version,loggedUsersOnly,challengeType});return;
      }
      if (op === 0) {
        this.border = r.u32(); this.clientId = r.u16(); const n = r.u8();
        if (!n) throw Error('Server returned no player slots');
        this.assignedIds = Array.from({length: n}, () => r.u16());
        this.ids = this.assignedIds.slice(0, this.slotLimit);
        this.cells.clear(); this.pending.clear(); this.lastAlive = []; this.ready = true; this.challenge=null;
        this.profile();
        this.emit({type: 'ready', slots: this.ids.length, assignedSlots: n, ids: this.ids, border: this.border});
      }
      if (op === 20 && this.ready) {
        for (let n = r.u16(); n > 0; n--) { r.u32(); this.cells.delete(r.u32()); }
        for (let n = r.u16(); n > 0; n--) {
          const id = r.u32(); if (!id) break;
          const x = r.i32(), y = r.i32(), radius = r.u16(), kind = r.u8(); let pid = -1;
          if (kind === 0) { pid = r.u16(); r.skip(3); }
          else if (kind === 2) r.skip(3);
          else if (kind === 5) { const len = r.u16(), start = r.i; r.skip(len); this.alloc(8, new Uint8Array(buffer.slice(start, start + len))); }
          else if (![1, 3, 4].includes(kind)) throw Error('Unsupported cell kind ' + kind);
          if (this.ids.includes(pid)) this.cells.set(id, {pid, x, y, radius});
        }
        for (let n = r.u16(); n > 0; n--) {
          const id = r.u32(), x = r.i32(), y = r.i32(), radius = r.u16();
          const cell = this.cells.get(id); if (cell) Object.assign(cell, {x, y, radius});
        }
        for (let n = r.u16(); n > 0; n--) { const id = r.u32(); if (!id) break; this.cells.delete(id); }
        const alive = this.ids.map((pid, tab) => [...this.cells.values()].some(c => c.pid === pid) ? tab : -1).filter(t => t >= 0);
        const died = this.lastAlive.filter(tab => !alive.includes(tab));
        alive.forEach(tab => this.pending.delete(tab)); this.lastAlive = alive;
        this.emit({type: 'world', alive, died, cells: this.cells.size});
      }
    }
    submitCaptcha(requestId,type,token) {
      const challenge=this.challenge;
      if(!challenge||challenge.id!==requestId||challenge.type!==type||challenge.submitted)return false;
      if(typeof token!=='string'||!token.length||token.length>65535)throw Error('Invalid verification token');
      const bytes=new Uint8Array(4+token.length),view=new DataView(bytes.buffer);bytes[0]=14;bytes[1]=type;view.setUint16(2,token.length,true);
      for(let i=0;i<token.length;i++){const value=token.charCodeAt(i);if(value>255)throw Error('Unexpected verification token encoding');bytes[i+4]=value;}
      this.send(bytes);challenge.submitted=true;this.emit({type:'verification-submitted',requestId});return true;
    }
    profile() {
      this.send(stringPacket(10, this.name)); this.send(stringPacket(11, this.tag));
      this.send(new Uint8Array([21, 0, 0])); // skin type 0, empty writeString16, as in the client.
    }
    spawn() {
      if (!this.ready) return;
      this.ids.forEach((pid, tab) => {
        if (!this.lastAlive.includes(tab) && (!this.pending.has(tab) || Date.now() - this.pending.get(tab) >= this.spawnRetryMs)) {
          this.profile();
          this.pending.set(tab, Date.now()); this.send(new Uint8Array([0, tab]));
          this.emit({type:"log",msg:"Spawn sent, slot "+tab+"; received opcodes: "+JSON.stringify(this.received)});
        }
      });
    }
    move(x, y) {
      if (!this.ready || !Number.isFinite(x) || !Number.isFinite(y)) return;
      this.ids.forEach((pid, tab) => {
        const b = new Uint8Array(11), v = new DataView(b.buffer); b[0] = 20; b[2] = tab;
        v.setInt32(3, x, true); v.setInt32(7, y, true); this.send(b);
      });
    }
    action(op, count=1) { const splits=Math.min(6,Math.max(1,Math.trunc(Number(count)||1))); if (this.ready) this.lastAlive.forEach(tab => this.send(new Uint8Array([op, tab, op === 22 ? splits : 0]))); }
  }
  g.OnyxBotProtocol = Protocol;
  if (typeof module !== 'undefined') module.exports = {Protocol, stringPacket};
})(typeof self !== 'undefined' ? self : globalThis);
