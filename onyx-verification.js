/* Visible official verification, one independently owned challenge per connection. */
(function(g){'use strict';
 const SITE_KEY='0x4AAAAAAACWFDYFT_opGqX8';
 function captchaPacket(type,token){
  if(!Number.isInteger(type)||type<0||type>255||typeof token!=='string'||!token.length||token.length>65535)throw Error('Invalid verification response');
  const bytes=new Uint8Array(4+token.length),view=new DataView(bytes.buffer);bytes[0]=14;bytes[1]=type;view.setUint16(2,token.length,true);
  for(let i=0;i<token.length;i++){const value=token.charCodeAt(i);if(value>255)throw Error('Unexpected verification token encoding');bytes[4+i]=value;}return bytes;
 }
 class VerificationQueue{
  constructor(view,clock=g){this.view=view;this.clock=clock;this.pending=new Map();this.waiting=[];this.active=null;}
  request(options){
   if(!options.owner||typeof options.isCurrent!=='function'||typeof options.submit!=='function')throw Error('Verification needs a current connection');
   const old=this.pending.get(options.owner);if(old&&old.key===options.key&&old.state!=='submitted')return old;
   if(old)this.cancel(options.owner,'Challenge replaced',false);
   const item={...options,state:'queued',attempt:0};this.pending.set(item.owner,item);this.waiting.push(item);
   item.timer=this.clock.setTimeout(()=>this.cancel(item.owner,'Verification timed out. Reconnect to try again.'),180000);
   this.pump();return item;
  }
  valid(item){return this.pending.get(item.owner)===item&&item.isCurrent();}
  release(item){if(this.active===item){this.active=null;this.view.close();}}
  cancel(owner,reason='Verification cancelled',notify=true){const item=this.pending.get(owner);if(!item)return;this.pending.delete(owner);this.clock.clearTimeout(item.timer);this.waiting=this.waiting.filter(x=>x!==item);this.release(item);item.state='cancelled';if(notify)item.onCancel?.(reason);this.pump();}
  complete(owner){const item=this.pending.get(owner);if(!item)return;this.pending.delete(owner);this.clock.clearTimeout(item.timer);this.waiting=this.waiting.filter(x=>x!==item);this.release(item);item.state='accepted';item.onState?.('accepted');this.pump();}
  pump(){
   if(this.active)return;let item;while((item=this.waiting.shift())){if(this.valid(item))break;if(this.pending.get(item.owner)===item){this.pending.delete(item.owner);this.clock.clearTimeout(item.timer);}item=null;}if(!item)return;
   this.active=item;this.display(item);
  }
  display(item){
   const attempt=++item.attempt;item.state='verifying';item.onState?.('verifying');
   const current=()=>this.active===item&&this.valid(item)&&item.attempt===attempt;
   this.view.show(item,{current,retry:()=>{if(current()){this.view.close();this.display(item);}},cancel:()=>{if(current())this.cancel(item.owner);},success:token=>{
    if(!current())return;try{if(item.submit(token)===false){this.cancel(item.owner,'The connection changed. Reconnect to verify.',false);return;}}
    catch(error){this.cancel(item.owner,error.message);return;}
    item.state='submitted';item.onState?.('submitted');this.release(item);this.pump();
   }});
  }
  status(){return{pending:this.pending.size,queued:this.waiting.length,active:this.active?.label||null};}
 }
 function createView(){
  let dialog,widget=null,renderEpoch=0,loading;
  function removeWidget(){if(widget!==null){try{g.turnstile?.remove(widget);}catch(_){}widget=null;}}
  function ensureAPI(){
   if(g.turnstile?.render)return Promise.resolve();if(loading)return loading;
   loading=new Promise((resolve,reject)=>{
    let script=document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
    if(script?.dataset.onyxFailed){script.remove();script=null;}
    const fresh=!script;if(!script){script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;}
    let timer;const finish=error=>{clearTimeout(timer);script.removeEventListener('load',loaded);script.removeEventListener('error',failed);if(error){script.dataset.onyxFailed='1';reject(error);}else resolve();};
    const loaded=()=>g.turnstile?.render?finish():finish(Error('Verification did not initialize. Press Retry.'));
    const failed=()=>finish(Error('Allow challenges.cloudflare.com in your content blocker, then press Retry.'));
    script.addEventListener('load',loaded,{once:true});script.addEventListener('error',failed,{once:true});timer=setTimeout(()=>finish(Error('Verification took too long to load. Check your connection and press Retry.')),20000);
    if(fresh)document.head.append(script);
   }).finally(()=>{loading=null;});return loading;
  }
  return{
   preload:ensureAPI,
   close(){renderEpoch++;removeWidget();dialog?.remove();dialog=null;},
   show(item,callbacks){
    this.close();const epoch=renderEpoch;dialog=document.createElement('dialog');dialog.id='onyx-verification-dialog';dialog.setAttribute('aria-labelledby','onyx-verification-title');
    dialog.style.cssText='width:min(430px,90vw);max-height:90vh;overflow:auto;box-sizing:border-box;padding:26px;border:1px solid #728a9d;border-radius:16px;background:#111a22;color:#edf4f9;font:14px/1.6 Segoe UI,sans-serif;box-shadow:0 20px 100px #000b;z-index:2147483647';
    const title=document.createElement('h2');title.id='onyx-verification-title';title.textContent='Verify '+item.label;title.style.margin='0 0 12px';
    const message=document.createElement('p');message.textContent='Complete the official check below. This result is used only for this connection.';
    const container=document.createElement('div'),status=document.createElement('p'),actions=document.createElement('div'),retry=document.createElement('button'),cancel=document.createElement('button');
    status.setAttribute('role','status');status.style.color='#aec9dc';status.textContent='Loading verification…';retry.textContent='Retry verification';cancel.textContent='Cancel connection';
    for(const button of [retry,cancel])button.style.cssText='padding:9px 12px;margin:5px 7px 0 0;border:1px solid #59738a;border-radius:6px;background:#233849;color:#edf4f9;cursor:pointer;font:inherit';
    retry.onclick=callbacks.retry;cancel.onclick=callbacks.cancel;actions.append(retry,cancel);dialog.append(title,message,container,status,actions);dialog.addEventListener('cancel',event=>{event.preventDefault();callbacks.cancel();});document.body.append(dialog);dialog.showModal();
    const current=()=>epoch===renderEpoch&&callbacks.current();
    ensureAPI().then(()=>{
     if(!current())return;status.textContent='Waiting for verification.';
     widget=g.turnstile.render(container,{sitekey:SITE_KEY,action:'game-connect',retry:'never',theme:'dark',size:'normal',callback:token=>{if(current())callbacks.success(token);},'error-callback':code=>{if(current())status.textContent='Verification failed ('+String(code).slice(0,20)+'). Check the connection and press Retry.';},'expired-callback':()=>{if(current())status.textContent='Verification expired. Press Retry to start a new check.';},'timeout-callback':()=>{if(current())status.textContent='Verification timed out. Press Retry.';}});
    }).catch(error=>{if(current())status.textContent=error.message;});
   }
  };
 }
 let browserPrepared=false,browserPreparation;
 function prepareBrowserSession(){
  if(browserPreparation)return browserPreparation;
  if(!g.location||!/(^|\.)senpa\.io$/i.test(g.location.hostname)){browserPrepared=true;return Promise.resolve();}
  try{g.localStorage?.removeItem('_afc_uid');document.cookie='_afc_uid=;path=/;max-age=0';document.cookie='_afc_uid=;path=/;max-age=0;domain=.senpa.io';}catch(_){}
  browserPreparation=new Promise(resolve=>{let finished=false;const done=()=>{if(finished)return;finished=true;clearTimeout(timer);browserPrepared=true;resolve();},timer=setTimeout(done,3000);
   Promise.resolve().then(()=>g.fetch('https://api.senpa.io/session/browser',{method:'POST',credentials:'include'})).then(done,done);
  });return browserPreparation;
 }
 const api={VerificationQueue,captchaPacket,siteKey:SITE_KEY};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(g.document){const view=createView(),queue=new VerificationQueue(view);g.ONYXVerification={request:options=>queue.request(options),cancel:(...args)=>queue.cancel(...args),complete:owner=>queue.complete(owner),status:()=>queue.status(),captchaPacket,prepareBrowserSession,browserReady:()=>browserPrepared};prepareBrowserSession();view.preload().catch(error=>console.warn('[ONYX verification] '+error.message));}
})(typeof window==='object'?window:globalThis);
