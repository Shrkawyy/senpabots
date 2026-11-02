"""Browser verification UI and packet routing with a synthetic transport/provider."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright()as p:
 browser=p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe',headless=True)
 page=browser.new_page(viewport={'width':1366,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route_web_socket('**/*',lambda socket:None)
 page.route('https://challenges.cloudflare.com/**',lambda route:route.fulfill(body='/* verification fixture: no live token */',content_type='text/javascript'))
 page.add_init_script("""window.__widgetCalls=[];window.turnstile={render(container,options){const button=document.createElement('button');button.textContent='Complete fixture verification';button.onclick=()=>options.callback('fixture-result-'+__widgetCalls.length);container.append(button);__widgetCalls.push(options);return 'fixture-'+__widgetCalls.length;},remove(){}};""")
 page.goto('http://127.0.0.1:3020/index.html',wait_until='domcontentloaded');page.wait_for_function('!!window.SC && !!window.ONYXVerification && !!window.ONYXBots',timeout=20000)
 page.evaluate("""()=>{window.__mainPackets=[];function socket(){return{readyState:1,OPEN:1,send(bytes){__mainPackets.push([...new Uint8Array(bytes)]);},close(){this.readyState=3;}};}SC.Tab1=socket();SC.Tab2=socket();SC.onMessage(Uint8Array.of(7,1,1).buffer,1);SC.onMessage(Uint8Array.of(7,1,1).buffer,2);}""")
 page.get_by_role('heading',name='Verify Player 1').wait_for();page.screenshot(path=str(ROOT/'artifacts/player-verification.png'))
 page.get_by_role('button',name='Complete fixture verification').click();page.get_by_role('heading',name='Verify Player 2').wait_for();page.get_by_role('button',name='Complete fixture verification').click()
 main=page.evaluate("""()=>{const out=__mainPackets.filter(p=>p[0]===14).map(p=>({opcode:p[0],type:p[1],length:p[2]+p[3]*256}));ONYXVerification.complete(SC.Tab1);ONYXVerification.complete(SC.Tab2);return out;}""")
 assert len(main)==2 and all(p['type']==1 for p in main),main
 page.add_script_tag(path=str(ROOT/'ffa/onyx-bot-protocol.js'))
 page.evaluate("""()=>{
 window.__botPackets=[];window.ONYXCreateBotCodec=()=>{const channel=new MessageChannel();const codec={onmessage:null,onerror:null,postMessage:data=>channel.port1.postMessage(data),terminate(){channel.port1.close();channel.port2.close();}};
 const emit=data=>channel.port2.postMessage(data);channel.port1.onmessage=e=>codec.onmessage?.(e);const protocol=window.__testBot=new OnyxBotProtocol(bytes=>__botPackets.push([...bytes]),emit);
 channel.port2.onmessage=e=>{const m=e.data;if(m.type==='connect')protocol.receive(Uint8Array.of(7,1,1).buffer);if(m.type==='verification-response')protocol.submitCaptcha(m.requestId,m.challengeType,m.token);if(m.type==='spawn')protocol.spawn();};queueMicrotask(()=>emit({type:'codec-ready'}));return codec;};
 ONYXFfaAdapter.readJwt=()=> 'fixture-session';const root=document.getElementById('onyx-bots-panel').shadowRoot;root.getElementById('count').value='1';root.getElementById('connect').click();
 }""")
 page.get_by_role('heading',name='Verify Bot 1').wait_for();page.get_by_role('button',name='Complete fixture verification').click();page.wait_for_function('__testBot.challenge.submitted')
 before=page.evaluate("()=>({ready:__testBot.ready,submitted:__testBot.challenge.submitted,verificationPackets:__botPackets.filter(p=>p[0]===14).length})")
 assert before=={'ready':False,'submitted':True,'verificationPackets':1},before
 page.evaluate("()=>{const b=new Uint8Array(10),v=new DataView(b.buffer);v.setUint32(1,20000,true);v.setUint16(5,9,true);b[7]=1;v.setUint16(8,10,true);__testBot.receive(b.buffer);}")
 page.wait_for_function("document.getElementById('onyx-bots-panel').shadowRoot.getElementById('counts').textContent.includes('1 ready')")
 page.evaluate("()=>document.getElementById('onyx-bots-panel').shadowRoot.getElementById('spawn').click()");page.wait_for_function('__botPackets.some(p=>p[0]===0)')
 actions=page.evaluate('__widgetCalls.map(o=>({action:o.action,retry:o.retry}))');assert all(o=={'action':'game-connect','retry':'never'}for o in actions),actions
 page.evaluate('()=>ONYXBots.stop()')
 report={'mainIndependentVerification':main,'botBeforeServerAcceptance':before,'botSpawnAfterServerReady':True,'officialWidgetOptions':actions,'pageErrors':errors,'scope':'Real page and MessageChannel, actual Protocol class; synthetic provider and transport. This does not prove live server acceptance.'}
 (ROOT/'artifacts/browser-verification-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));browser.close();assert not errors
