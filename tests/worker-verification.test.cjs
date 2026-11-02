'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('actual worker routes a matching widget response to its socket and waits for server ready',async()=>{
 const events=[],sent=[],callbacks={};let context;const factory=options=>{const module={_alloc(){},create(url,open,close,message,error){Object.assign(callbacks,{open,close,message,error});return{send(bytes){sent.push([...bytes]);},close(){close();}};}};queueMicrotask(()=>options.postRun());return module;};
 context={Uint8Array,ArrayBuffer,DataView,Map,Set,Promise,URL,Date,Number,Error,queueMicrotask,location:{href:'https://senpa.io/web/'},postMessage:event=>events.push(event)};context.self=context;context.window=context;
 context.importScripts=name=>{if(name==='./onyx-bot-protocol.js')vm.runInContext(fs.readFileSync(path.join(__dirname,'../ffa/onyx-bot-protocol.js'),'utf8'),context);else context.webpackChunkeon_client.push([[214],{458(module,exports,require){require.d(exports,{A:()=>factory});}}]);};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../ffa/onyx-bot-worker.js'),'utf8'),context);await new Promise(resolve=>setImmediate(resolve));assert(events.some(e=>e.type==='codec-ready'));
 context.onmessage({data:{type:'connect',url:'wss://eu1.senpa.io:7101?po=senpa.io&tid=fixture',token:'fixture-session',slotLimit:1}});await new Promise(resolve=>setImmediate(resolve));callbacks.open();callbacks.message(Uint8Array.of(7,1,1).buffer);const request=events.find(e=>e.type==='verification-required');assert(request);
 context.onmessage({data:{type:'verification-response',requestId:request.requestId+1,challengeType:1,token:'obsolete'}});assert.equal(sent.length,0);
 context.onmessage({data:{type:'verification-response',requestId:request.requestId,challengeType:1,token:'fixture-result'}});assert.equal(sent.length,1);assert.equal(sent[0][0],14);assert.equal(sent[0][1],1);assert(events.some(e=>e.type==='verification-submitted'));
 context.onmessage({data:{type:'spawn'}});assert.equal(sent.length,1);
 const greeting=new Uint8Array(10),view=new DataView(greeting.buffer);view.setUint32(1,20000,true);view.setUint16(5,9,true);greeting[7]=1;view.setUint16(8,10,true);callbacks.message(greeting.buffer);assert(events.some(e=>e.type==='ready'));context.onmessage({data:{type:'spawn'}});assert(sent.some(packet=>packet[0]===0));context.onmessage({data:{type:'close'}});
});
