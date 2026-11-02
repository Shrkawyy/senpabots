"""Run the actual hosted loader with a GM bridge fetching public HTTPS assets.

The page and game transport are fixtures. No real login, game connection or
verification challenge is performed, and no local asset server is used.
"""
import asyncio
import base64
import json
from pathlib import Path
from urllib.request import Request, urlopen
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'kateronyx.user.js').read_text(encoding='utf-8')


def fetch_asset(request):
    try:
        with urlopen(Request(request['url'], headers={'User-Agent': 'Mozilla/5.0'}), timeout=30) as response:
            data = response.read()
            return {'status': response.status, 'bytes': len(data), 'data': base64.b64encode(data).decode()}
    except Exception as error:
        return {'error': str(error)}


async def run():
    report = {'scope': 'Actual userscript and public HTTPS assets; GM API shim and synthetic page/transport. No live verification or gameplay claim.'}
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='C:/Program Files/Google/Chrome/Application/chrome.exe', headless=True)
        for failing in [False, True]:
            page = await browser.new_page(viewport={'width': 1366, 'height': 900})
            errors, requests = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await page.route_web_socket('**/*', lambda socket: None)
            await page.route('https://senpa.io/web/', lambda route: route.fulfill(body='<!doctype html><html><head><title>Loader fixture</title></head><body></body></html>', content_type='text/html'))
            await page.route('https://api.senpa.io/**', lambda route: route.fulfill(status=204))
            await page.route('https://challenges.cloudflare.com/**', lambda route: route.fulfill(body='window.turnstile={render(){return "fixture";},remove(){}};', content_type='text/javascript'))

            async def gm_request(request):
                result = {'error': 'fixture asset failure'} if failing else await asyncio.to_thread(fetch_asset, request)
                requests.append({'url': request['url'], 'status': result.get('status'), 'bytes': result.get('bytes'), 'error': result.get('error')})
                return result

            await page.expose_function('__gmFetch', gm_request)
            await page.goto('https://senpa.io/web/', wait_until='domcontentloaded')
            await page.evaluate('''() => {
                localStorage.setItem('kateronyx:base-url','http://127.0.0.1:3020/');
                window.GM_info={script:{version:'2.6.4'}};
                window.GM_xmlhttpRequest=options=>{
                    __gmFetch({url:options.url}).then(result=>{
                        if(result.error){options.onerror?.(result);return;}
                        const bytes=Uint8Array.from(atob(result.data), ch=>ch.charCodeAt(0));
                        options.onload({status:result.status,response:options.responseType==='arraybuffer'?bytes.buffer:new TextDecoder().decode(bytes)});
                    }).catch(error=>options.onerror?.(error));
                };
            }''')
            await page.add_script_tag(content=SCRIPT)
            if failing:
                await page.get_by_role('heading', name='KaterOnyx could not load').wait_for(timeout=10000)
                await page.wait_for_timeout(100)
                assert await page.get_by_role('link', name='Reinstall hosted userscript').get_attribute('href') == 'https://senpabots.vercel.app/kateronyx.user.js'
                assert len(requests) == 1, requests
                report['failedAsset'] = {'requests': requests, 'pageErrors': errors, 'recoveryLinkCorrect': True}
            else:
                await page.wait_for_function('!!window.SC && !!window.ONYXVerification && !!window.ONYXBots', timeout=90000)
                assert await page.locator('#canvas').count() == 1
                await page.screenshot(path=str(ROOT / 'artifacts/hosted-loader-preview.png'))
                report['hostedBoot'] = {'requests': requests, 'pageErrors': errors, 'canvas': True, 'verificationModule': True, 'botPanel': True}
            assert not errors, errors
            assert requests and all(item['url'].startswith('https://') for item in requests)
            assert not any('127.0.0.1' in item['url'] or 'localhost' in item['url'] for item in requests)
            await page.close()
        await browser.close()
    (ROOT / 'artifacts/browser-hosted-loader-report.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


asyncio.run(run())
