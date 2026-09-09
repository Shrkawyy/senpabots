// ==UserScript==
// @name         KaterOnyx FFA for Senpa
// @namespace    https://kateronyx.local/ffa
// @version      2.0.6
// @description  Loads the full ONYX engine (deo.onyx + PIXI + WASM create) on Senpa's official origin.
// @author       ZkaOnyx
// @match        https://senpa.io/*
// @match        https://www.senpa.io/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @connect      127.0.0.1
// @connect      localhost
// @connect      192.168.1.6
// @connect      pixijs.download
// @connect      cdn.jsdelivr.net
// @connect      unpkg.com
// @connect      cdn.rawgit.com
// @connect      *
// @updateURL    none
// @downloadURL  none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var DEFAULT_BASE_URL = 'https://senpabots.vercel.app/';
  var CLIENT_FILE = 'index.html';
  var VERSION = '2.0.6';
  var MOUNT_KEY = 'kateronyx:mounting';
  var LOCAL_CSS = [
    'assets/css/albion.css',
    'assets/css/onyx-theme.css',
    'assets/css/ryuten-theme.css'
  ];
  var CDN_SCRIPTS = [
    ['https://pixijs.download/v5.2.0/pixi.min.js', 'pixi.min.js'],
    ['https://cdn.jsdelivr.net/npm/pixi-filters@2.7.1/dist/pixi-filters.js', 'pixi-filters.js'],
    ['https://unpkg.com/tippy.js@2.0.6/dist/tippy.all.min.js', 'tippy.all.min.js'],
    ['https://cdn.rawgit.com/dcodeIO/protobuf.js/6.8.8/dist/protobuf.min.js', 'protobuf.min.js']
  ];

  function isLocalHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  }

  function normalizeBaseUrl(value) {
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' && !isLocalHost(url.hostname)) return DEFAULT_BASE_URL;
      return url.href.endsWith('/') ? url.href : url.href + '/';
    } catch (_) {
      return DEFAULT_BASE_URL;
    }
  }

  function getBaseUrl() {
    var override = '';
    try { override = localStorage.getItem('kateronyx:base-url') || ''; } catch (_) {}
    if (/^https:\/\/onyx-og\.vercel\.app\/?$/.test(override)) override = '';
    return normalizeBaseUrl(override || DEFAULT_BASE_URL);
  }

  function srcOf(el) {
    return (el && (el.src || el.href || el.getAttribute && (el.getAttribute('src') || el.getAttribute('href')))) || '';
  }

  var SENPA_AD = /adinplay|ad-manager|prebid|doubleclick|googlesyndication|googleadservices|adsbygoogle|amazon-adsystem|imasdk|tag\.min\.js|pagead2|securepubads|adnxs|rubiconproject|pubmatic|openx|criteo|id5-sync|adsystem|advertising\.com/i;

  function isAllowedKeep(src) {
    if (!src) return false;
    if (src.indexOf('blob:') === 0) return true;
    if (src.indexOf('kateronyx') !== -1) return true;
    if (/challenges\.cloudflare\.com/i.test(src)) return true;
    if (/fonts\.googleapis\.com|fonts\.gstatic\.com|use\.fontawesome\.com/i.test(src)) return true;
    if (/pixijs\.download|cdn\.jsdelivr\.net\/npm\/pixi-filters|unpkg\.com\/tippy|cdn\.rawgit\.com\/dcodeIO\/protobuf/i.test(src)) return true;
    return false;
  }

  function killSenpaRuntime() {
    try {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          for (var i = 0; i < regs.length; i++) regs[i].unregister();
          if (regs.length) console.log('[ONYX] SENPA_SW_REMOVED', regs.length);
        }).catch(function () {});
        try {
          Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            get: function () { return undefined; }
          });
        } catch (_) {
          if (navigator.serviceWorker.register) {
            navigator.serviceWorker.register = function () {
              return Promise.reject(new Error('ONYX blocked service worker'));
            };
          }
        }
      }
    } catch (_) {}
    try {
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          for (var i = 0; i < keys.length; i++) caches.delete(keys[i]);
        }).catch(function () {});
      }
    } catch (_) {}

    function blockScriptSrc(el, url) {
      if (isAllowedKeep(url)) return false;
      try { el.type = 'javascript/blocked'; } catch (_) {}
      try { el.removeAttribute('src'); } catch (_) {}
      console.log('[ONYX] BLOCKED_SCRIPT', String(url || 'inline').slice(0, 120));
      return true;
    }

    try {
      var proto = HTMLScriptElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'src') ||
        Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'src');
      if (desc && desc.set) {
        Object.defineProperty(proto, 'src', {
          configurable: true,
          enumerable: desc.enumerable,
          get: desc.get,
          set: function (value) {
            if (blockScriptSrc(this, String(value || ''))) return;
            return desc.set.call(this, value);
          }
        });
      }
    } catch (_) {}

    try {
      var create = Document.prototype.createElement;
      Document.prototype.createElement = function (name, opts) {
        var el = create.call(this, name, opts);
        var tag = String(name || '').toLowerCase();
        if (tag === 'iframe' || tag === 'embed' || tag === 'object') {
          var kill = function () {
            var src = el.src || el.getAttribute && (el.getAttribute('src') || el.getAttribute('data')) || '';
            if (SENPA_AD.test(src) || /senpa\.io/i.test(src) && !isAllowedKeep(src)) {
              el.remove();
              console.log('[ONYX] BLOCKED_FRAME', String(src).slice(0, 80));
            }
          };
          el.addEventListener('load', kill, true);
          setTimeout(kill, 0);
        }
        return el;
      };
    } catch (_) {}
  }

  function isOfficialRuntimeNode(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName;
    var src = srcOf(el);
    if (isAllowedKeep(src)) return false;
    if (tag === 'SCRIPT' || tag === 'IFRAME' || tag === 'EMBED' || tag === 'OBJECT') return true;
    if (tag === 'LINK') {
      var rel = (el.rel || '').toLowerCase();
      if (rel === 'modulepreload' || rel === 'preload' || rel === 'module') return true;
      if (/main-|adinplay|prebid|ad-manager|senpa|tag\.min/i.test(src)) return true;
    }
    if (tag === 'CANVAS' && el.id !== 'gameCanvas' && el.id !== 'canvas' && el.id !== 'minimap-nodes') return true;
    return false;
  }

  function stripOfficial(root) {
    if (!root || root.nodeType !== 1) return;
    if (isOfficialRuntimeNode(root)) {
      root.remove();
      return;
    }
    var nodes = root.querySelectorAll('script,iframe,embed,object,link[rel="modulepreload"],link[rel="preload"],link[rel="module"]');
    for (var i = 0; i < nodes.length; i++) {
      if (isOfficialRuntimeNode(nodes[i])) nodes[i].remove();
    }
  }

  function seizePage() {
    try { window.stop(); } catch (_) {}
    try {
      document.open();
      document.write('<!doctype html><html><head><meta charset="utf-8"><title>ONYX</title></head><body></body></html>');
      document.close();
    } catch (_) {
      try {
        if (document.documentElement) document.documentElement.innerHTML = '<head></head><body></body>';
      } catch (__) {}
    }
    var observer = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) stripOfficial(added[j]);
      }
    });
    if (document.documentElement) {
      observer.observe(document.documentElement, { childList: true, subtree: true });
      stripOfficial(document.documentElement);
    }
    window.addEventListener('beforescriptexecute', function (ev) {
      var src = ev.target && ev.target.src;
      if (!isAllowedKeep(src || 'inline-blocked')) ev.preventDefault();
    }, true);
    return observer;
  }

  function renderLoading() {
    var style = document.createElement('style');
    style.id = 'kateronyx-loading-style';
    style.textContent =
      'html{background:#05060c!important}' +
      'body{visibility:hidden!important}' +
      "html::before{content:'Loading ONYX...';position:fixed;z-index:2147483647;inset:0;display:grid;place-items:center;background:#05060c;color:#22d3ee;font:700 18px Rajdhani,system-ui,sans-serif;letter-spacing:.2em;visibility:visible}";
    (document.head || document.documentElement).appendChild(style);
  }

  function renderError(message) {
    window.stop();
    document.title = 'KaterOnyx load error';
    var head = document.createElement('head');
    var body = document.createElement('body');
    var style = document.createElement('style');
    var box = document.createElement('div');
    var title = document.createElement('h1');
    var detail = document.createElement('p');
    var help = document.createElement('p');
    var reload = document.createElement('button');
    style.textContent = 'html,body{height:100%;margin:0;background:#090b10;color:#e8eef6;font:16px system-ui,sans-serif}body{display:grid;place-items:center}.box{max-width:640px;padding:30px;border:1px solid #2a3645;border-radius:14px;background:#111721}h1{margin-top:0;color:#ff647c}button{padding:10px 16px;border:0;border-radius:8px;cursor:pointer}code{color:#7de8ff}';
    box.className = 'box';
    title.textContent = 'KaterOnyx could not load';
    detail.textContent = String(message);
    help.innerHTML = 'Serve the KaterOnyx folder (<code>npx serve -p 4173</code>), then set <code>localStorage.setItem("kateronyx:base-url","http://127.0.0.1:4173/")</code> on this page if needed.';
    reload.textContent = 'Reload';
    reload.addEventListener('click', function () { location.reload(); });
    box.append(title, detail, help, reload);
    head.appendChild(style);
    body.appendChild(box);
    document.documentElement.replaceChildren(head, body);
  }

  function gmGet(url, responseType) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        responseType: responseType || 'text',
        timeout: 30000,
        headers: { 'Cache-Control': 'no-cache' },
        onload: function (response) {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(url + ' HTTP ' + response.status));
            return;
          }
          resolve(response.response);
        },
        onerror: function () { reject(new Error('Request failed: ' + url)); },
        ontimeout: function () { reject(new Error('Request timed out: ' + url)); }
      });
    });
  }

  function rewriteAssets(doc, baseUrl) {
    var nodes = doc.querySelectorAll('[href],[src]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var attr = el.hasAttribute('src') ? 'src' : 'href';
      var value = el.getAttribute(attr);
      if (!value) continue;
      if (el.tagName === 'LINK' && /stylesheet/i.test(el.rel || '')) continue;
      if (/senpa\.io/i.test(value) && /ryuten|iconfont|\.woff/i.test(value)) {
        try {
          var name = new URL(value, 'https://senpa.io/').pathname.split('/').pop();
          el.setAttribute(attr, new URL('assets/ryuten/' + name, baseUrl).href);
        } catch (_) {}
        continue;
      }
      if (/^(https?:|data:|blob:|#|\/\/)/i.test(value)) continue;
      el.setAttribute(attr, new URL(value, baseUrl).href);
    }
  }

  function rewriteCssUrls(css, baseUrl, fontBlobUrl) {
    return String(css || '').replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, function (full, _q, raw) {
      var url = String(raw || '').trim();
      if (!url || /^(data:|blob:|#)/i.test(url)) return full;
      if (/iconfont|\.woff2?(?:$|\?)/i.test(url) && fontBlobUrl) {
        return 'url(' + JSON.stringify(fontBlobUrl) + ')';
      }
      if (/^(https?:|\/\/)/i.test(url)) {
        if (/senpa\.io/i.test(url) && /ryuten|iconfont|\.woff/i.test(url)) {
          try {
            var abs = url.indexOf('//') === 0 ? 'https:' + url : url;
            var file = new URL(abs).pathname.split('/').pop();
            return 'url(' + JSON.stringify(new URL('assets/ryuten/' + file, baseUrl).href) + ')';
          } catch (_) { return full; }
        }
        return full;
      }
      try {
        return 'url(' + JSON.stringify(new URL(url, baseUrl + 'assets/css/').href) + ')';
      } catch (_) { return full; }
    });
  }

  function inlineLocalStyles(doc, cssMap) {
    var links = Array.prototype.slice.call(doc.querySelectorAll('link[rel="stylesheet"]'));
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute('href') || '';
      var key = '';
      for (var k = 0; k < LOCAL_CSS.length; k++) {
        if (href.indexOf(LOCAL_CSS[k]) !== -1) { key = LOCAL_CSS[k]; break; }
      }
      if (!key) continue;
      var style = doc.createElement('style');
      style.setAttribute('data-onyx-css', key);
      style.textContent = cssMap[key] || '';
      link.replaceWith(style);
    }
  }

  function injectScript(text, label) {
    return new Promise(function (resolve, reject) {
      var blob = new Blob([text + '\n//# sourceURL=kateronyx://' + label], { type: 'text/javascript' });
      var script = document.createElement('script');
      script.src = URL.createObjectURL(blob);
      script.addEventListener('load', function () { resolve(); }, { once: true });
      script.addEventListener('error', function () { reject(new Error('inject failed: ' + label)); }, { once: true });
      document.body.appendChild(script);
    });
  }

  function wasmHookSource(gameBlob, fsBlob, fontBlob, baseUrl) {
    return (
      'window.__KATERONYX_USERSCRIPT__=true;' +
      'window.__KATERONYX_BASE_URL=' + JSON.stringify(baseUrl) + ';' +
      'window.__KATERONYX_WASM_BLOB__=' + JSON.stringify(gameBlob) + ';' +
      'window.__KATERONYX_WASM89_BLOB__=' + JSON.stringify(fsBlob) + ';' +
      'window.__KATERONYX_FONT_BLOB__=' + JSON.stringify(fontBlob || '') + ';' +
      'window.k=window.k||{};' +
      'window.k.locateFile=function(name){' +
      'name=String(name||"");' +
      'if(/89\\.wasm/i.test(name)&&!/899\\.wasm/i.test(name)) return window.__KATERONYX_WASM89_BLOB__;' +
      'return window.__KATERONYX_WASM_BLOB__;};' +
      '(function(){' +
      'function hrefOf(input){' +
      'if(!input) return "";' +
      'if(typeof input==="string") return input;' +
      'if(typeof URL!=="undefined"&&input instanceof URL) return String(input);' +
      'if(typeof Request!=="undefined"&&input instanceof Request) return input.url||"";' +
      'return (input&&input.url)||String(input);}' +
      'function isFsWasm(url){return /(?:^|[\\/]|%2F)89\\.wasm(?:\\?|$)/i.test(url)&&!/899\\.wasm/i.test(url);}' +
      'function isGameWasm(url){return /bundle2?\\.wasm|899\\.wasm/i.test(url);}' +
      'function isAnyWasm(url){return /\\.wasm(?:\\?|$)/i.test(url)||isGameWasm(url)||isFsWasm(url);}' +
      'function looksHtmlUrl(url){return /senpa\\.io/i.test(url)&&!/^blob:/i.test(url);}' +
      'function mapWasm(url){' +
      'if(!url||/^blob:/i.test(url)||!isAnyWasm(url)) return null;' +
      'if(isFsWasm(url)) return window.__KATERONYX_WASM89_BLOB__;' +
      'return window.__KATERONYX_WASM_BLOB__;}' +
      'function mapFont(url){' +
      'if(!url||!window.__KATERONYX_FONT_BLOB__) return null;' +
      'if(/senpa\\.io/i.test(url)&&( /iconfont|\\/ryuten\\/|\\.woff2?(?:\\?|$)/i.test(url))) return window.__KATERONYX_FONT_BLOB__;' +
      'return null;}' +
      'function logRewrite(kind,url){' +
      'if(window.__KATERONYX_REWRITE_LOGGED__) return;' +
      'window.__KATERONYX_REWRITE_LOGGED__=true;' +
      'console.log("[ONYX-ENGINE] "+kind+" fetch rewritten from HTML-looking url", String(url).slice(0,96));}' +
      'var nativeFetch=window.fetch;' +
      'if(nativeFetch){window.fetch=function(input,init){' +
      'var url=hrefOf(input);' +
      'var wasm=mapWasm(url);' +
      'if(wasm){' +
      'if(!window.__KATERONYX_WASM_USED_LOGGED__){window.__KATERONYX_WASM_USED_LOGGED__=true;console.log("[ONYX-ENGINE] wasm blob used");}' +
      'if(looksHtmlUrl(url)) logRewrite("wasm",url);' +
      'return nativeFetch.call(this,wasm,init);}' +
      'var font=mapFont(url);' +
      'if(font){if(looksHtmlUrl(url)) logRewrite("font",url);return nativeFetch.call(this,font,init);}' +
      'return nativeFetch.apply(this,arguments);};}' +
      'var open=XMLHttpRequest.prototype.open;' +
      'XMLHttpRequest.prototype.open=function(method,url){' +
      'if(typeof url==="string"){' +
      'var wasm=mapWasm(url);' +
      'if(wasm){if(!window.__KATERONYX_WASM_USED_LOGGED__){window.__KATERONYX_WASM_USED_LOGGED__=true;console.log("[ONYX-ENGINE] wasm blob used");}if(looksHtmlUrl(url)) logRewrite("wasm",url);arguments[1]=wasm;}' +
      'else{var font=mapFont(url);if(font){if(looksHtmlUrl(url)) logRewrite("font",url);arguments[1]=font;}}' +
      '}' +
      'return open.apply(this,arguments);};' +
      'if(typeof WebAssembly!=="undefined"&&WebAssembly.instantiateStreaming){' +
      'var nativeIS=WebAssembly.instantiateStreaming.bind(WebAssembly);' +
      'WebAssembly.instantiateStreaming=function(source,imports){' +
      'return Promise.resolve(source).then(function(src){' +
      'var url=(src&&src.url)||"";' +
      'var wasm=mapWasm(url);' +
      'if(wasm){if(looksHtmlUrl(url)) logRewrite("wasm",url);return nativeFetch.call(window,wasm).then(function(res){return nativeIS(res,imports);});}' +
      'return nativeIS(src,imports);});};}' +
      '})();' +
      'console.log("[ONYX] BOOT");' +
      'console.log("[ONYX-ENGINE] wasm blobs ready (game+89, not wasmLoader.js)");' +
      'console.log("[ONYX] SENPA_GAME_BLOCKED = true");' +
      'console.log("[ONYX] THEME_INLINED = true");'
    );
  }


  // Embedded bot assets: same-origin blob worker, no cross-origin Worker/importScripts.
  async function mountBotPanel(wasm) {
    var workerSource = "self.addEventListener('error', function (event) {\n  self.postMessage({type:'error', msg:'Worker startup: ' + (event.message || 'unknown error') + ' at line ' + (event.lineno || 0)});\n});\nself.addEventListener('unhandledrejection', function (event) {\n  self.postMessage({type:'error', msg:'Worker promise: ' + String(event.reason && event.reason.message || event.reason || 'unknown error')});\n});\nself.postMessage({type:'worker-loaded'});\n/**\n * ONYX FFA codec worker.\n *\n * Runs Jaxx bundle.wasm in a dedicated worker global so it cannot share\n * Emscripten embind/emval state with deo.onyx.beautified.js on the page.\n *\n * This is not the Jaxx lobby/app. Only wasmLoader Module.create() for\n * encrypt/decrypt of the Senpa FFA WebSocket.\n */\n/* eslint-disable no-undef */\n(function () {\n  'use strict';\n\n  // wasmLoader/embind looks up constructors via window/globalThis.\n  // Dedicated workers have WebSocket on `self`, but no `window`.\n  // Without this, emval `instanceof` RHS is undefined (handle 1).\n  if (typeof self.window === 'undefined') self.window = self;\n  if (typeof self.document === 'undefined') {\n    self.document = { location: self.location, currentScript: null, baseURI: self.location.href };\n  }\n\n  /* Senpa v4 packets, grounded in the bundled client. No renderer or page globals. */\n(function (g) {\n  'use strict';\n  class Reader {\n    constructor(buffer) { this.v = new DataView(buffer); this.i = 0; }\n    u8() { return this.v.getUint8(this.i++); }\n    u16() { const n = this.v.getUint16(this.i, true); this.i += 2; return n; }\n    u32() { const n = this.v.getUint32(this.i, true); this.i += 4; return n; }\n    i32() { const n = this.v.getInt32(this.i, true); this.i += 4; return n; }\n    skip(n) { if (this.i + n > this.v.byteLength) throw Error('Truncated packet'); this.i += n; }\n  }\n  function stringPacket(op, text, long) {\n    text = String(text || '').slice(0, long ? 65535 : 255);\n    const b = new Uint8Array(1 + (long ? 2 : 1) + text.length * 2), v = new DataView(b.buffer);\n    b[0] = op; if (long) v.setUint16(1, text.length, true); else b[1] = text.length;\n    for (let i = 0; i < text.length; i++) v.setUint16(1 + (long ? 2 : 1) + i * 2, text.charCodeAt(i), true);\n    return b;\n  }\n  class Protocol {\n    constructor(send, emit, alloc) {\n      this.send = send; this.emit = emit; this.alloc = alloc || (() => {});\n      this.ready = false; this.ids = []; this.cells = new Map(); this.pending = new Map();\n      this.lastAlive = []; this.name = 'Bot'; this.token = 'null';\n    }\n    receive(buffer) {\n      const r = new Reader(buffer), op = r.u8();\n      if (op === 8) this.send(stringPacket(13, this.token, true));\n      if (op === 7) { this.ready = false; this.emit({type: 'blocked', reason: 'CAPTCHA required \u2014 connection stopped'}); return; }\n      if (op === 0) {\n        this.border = r.u32(); this.clientId = r.u16(); const n = r.u8();\n        if (!n) throw Error('Server returned no player slots');\n        this.ids = Array.from({length: n}, () => r.u16());\n        this.cells.clear(); this.pending.clear(); this.lastAlive = []; this.ready = true;\n        this.send(stringPacket(10, this.name)); this.send(stringPacket(11, ''));\n        this.emit({type: 'ready', slots: n, border: this.border});\n      }\n      if (op === 20 && this.ready) {\n        for (let n = r.u16(); n > 0; n--) { r.u32(); this.cells.delete(r.u32()); }\n        for (let n = r.u16(); n > 0; n--) {\n          const id = r.u32(); if (!id) break;\n          const x = r.i32(), y = r.i32(), radius = r.u16(), kind = r.u8(); let pid = -1;\n          if (kind === 0) { pid = r.u16(); r.skip(3); }\n          else if (kind === 2) r.skip(3);\n          else if (kind === 5) { const len = r.u16(), start = r.i; r.skip(len); this.alloc(8, new Uint8Array(buffer.slice(start, start + len))); }\n          else if (![1, 3, 4].includes(kind)) throw Error('Unsupported cell kind ' + kind);\n          if (this.ids.includes(pid)) this.cells.set(id, {pid, x, y, radius});\n        }\n        for (let n = r.u16(); n > 0; n--) {\n          const id = r.u32(), x = r.i32(), y = r.i32(), radius = r.u16();\n          const cell = this.cells.get(id); if (cell) Object.assign(cell, {x, y, radius});\n        }\n        for (let n = r.u16(); n > 0; n--) { const id = r.u32(); if (!id) break; this.cells.delete(id); }\n        const alive = this.ids.map((pid, tab) => [...this.cells.values()].some(c => c.pid === pid) ? tab : -1).filter(t => t >= 0);\n        const died = this.lastAlive.filter(tab => !alive.includes(tab));\n        alive.forEach(tab => this.pending.delete(tab)); this.lastAlive = alive;\n        this.emit({type: 'world', alive, died, cells: this.cells.size});\n      }\n    }\n    spawn() {\n      if (!this.ready) return;\n      this.ids.forEach((pid, tab) => {\n        if (!this.lastAlive.includes(tab) && !this.pending.has(tab)) {\n          this.pending.set(tab, Date.now()); this.send(new Uint8Array([0, tab]));\n        }\n      });\n    }\n    move(x, y) {\n      if (!this.ready || !Number.isFinite(x) || !Number.isFinite(y)) return;\n      this.ids.forEach((pid, tab) => {\n        const b = new Uint8Array(11), v = new DataView(b.buffer); b[0] = 20; b[2] = tab;\n        v.setInt32(3, x, true); v.setInt32(7, y, true); this.send(b);\n      });\n    }\n    action(op) { if (this.ready) this.lastAlive.forEach(tab => this.send(new Uint8Array([op, tab, op === 22 ? 1 : 0]))); }\n  }\n  g.OnyxBotProtocol = Protocol;\n  if (typeof module !== 'undefined') module.exports = {Protocol, stringPacket};\n})(typeof self !== 'undefined' ? self : globalThis);\n\n  var protocol = null;\n  var factories = Object.create(null);\n  var installed = Object.create(null);\n\n  function requireFactory(id) {\n    if (installed[id]) return installed[id].exports;\n    var factory = factories[id];\n    if (!factory) throw new Error('FFA codec: webpack module ' + id + ' missing');\n    var module = installed[id] = { id: id, exports: {} };\n    factory.call(module.exports, module, module.exports, requireFactory);\n    return module.exports;\n  }\n\n  requireFactory.d = function (exports, definition) {\n    for (var key in definition) {\n      if (Object.prototype.hasOwnProperty.call(definition, key)) {\n        Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });\n      }\n    }\n  };\n  requireFactory.r = function () {};\n  requireFactory.n = function (mod) {\n    var getter = function () { return mod && mod.__esModule ? mod.default : mod; };\n    requireFactory.d(getter, { a: getter });\n    return getter;\n  };\n  requireFactory.o = function (obj, prop) {\n    return Object.prototype.hasOwnProperty.call(obj, prop);\n  };\n\n  self.webpackChunkeon_client = [];\n  self.webpackChunkeon_client.push = function (chunk) {\n    if (chunk && chunk[1]) {\n      var mods = chunk[1];\n      for (var id in mods) {\n        if (Object.prototype.hasOwnProperty.call(mods, id)) factories[id] = mods[id];\n      }\n    }\n    return self.webpackChunkeon_client.length;\n  };\n\n  try {\n    \"use strict\";(self.webpackChunkeon_client=self.webpackChunkeon_client||[]).push([[214],{458(n,r,e){function t(n){return t=\"function\"==typeof Symbol&&\"symbol\"==typeof Symbol.iterator?function(n){return typeof n}:function(n){return n&&\"function\"==typeof Symbol&&n.constructor===Symbol&&n!==Symbol.prototype?\"symbol\":typeof n},t(n)}function o(){var n,r=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},e={};for(n in r)r.hasOwnProperty(n)&&(e[n]=r[n]);var o,i,a=[],u=function(n,r){throw r},f=\"object\"===(\"undefined\"==typeof window?\"undefined\":t(window)),c=\"function\"==typeof importScripts,l=\"\";(f||c)&&(c?l=self.location.href:\"undefined\"!=typeof document&&document.currentScript&&(l=document.currentScript.src),l=0!==l.indexOf(\"blob:\")?l.substr(0,l.lastIndexOf(\"/\")+1):\"\",c&&(i=function(n){var r=new XMLHttpRequest;return r.open(\"GET\",n,!1),r.responseType=\"arraybuffer\",r.send(null),new Uint8Array(r.response)}),o=function(n,r,e){var t=new XMLHttpRequest;t.open(\"GET\",n,!0),t.responseType=\"arraybuffer\",t.onload=function(){200==t.status||0==t.status&&t.response?r(t.response):e()},t.onerror=e,t.send(null)}),r.print||console.log.bind(console);var s,d=r.printErr||console.warn.bind(console);for(n in e)e.hasOwnProperty(n)&&(r[n]=e[n]);e=null,r.arguments&&(a=r.arguments),r.thisProgram&&r.thisProgram,r.quit&&(u=r.quit),r.wasmBinary&&(s=r.wasmBinary);var p=r.noExitRuntime||!0;\"object\"!==(\"undefined\"==typeof WebAssembly?\"undefined\":t(WebAssembly))&&J(\"no native wasm support detected\");var v,h=!1,y=\"undefined\"!=typeof TextDecoder?new TextDecoder(\"utf8\"):void 0;function m(n,r){return n?function(n,r,e){for(var t=r+e,o=r;n[o]&&!(o>=t);)++o;if(o-r>16&&n.subarray&&y)return y.decode(n.subarray(r,o));for(var i=\"\";r<o;){var a=n[r++];if(128&a){var u=63&n[r++];if(192!=(224&a)){var f=63&n[r++];if((a=224==(240&a)?(15&a)<<12|u<<6|f:(7&a)<<18|u<<12|f<<6|63&n[r++])<65536)i+=String.fromCharCode(a);else{var c=a-65536;i+=String.fromCharCode(55296|c>>10,56320|1023&c)}}else i+=String.fromCharCode((31&a)<<6|u)}else i+=String.fromCharCode(a)}return i}(b,n,r):\"\"}var g,w,b,A,T,_,C,P,E,k=\"undefined\"!=typeof TextDecoder?new TextDecoder(\"utf-16le\"):void 0;function F(n,r){for(var e=n,t=e>>1,o=t+r/2;!(t>=o)&&T[t];)++t;if((e=t<<1)-n>32&&k)return k.decode(b.subarray(n,e));for(var i=\"\",a=0;!(a>=r/2);++a){var u=A[n+2*a>>1];if(0==u)break;i+=String.fromCharCode(u)}return i}function W(n,r,e){if(void 0===e&&(e=2147483647),e<2)return 0;for(var t=r,o=(e-=2)<2*n.length?e/2:n.length,i=0;i<o;++i){var a=n.charCodeAt(i);A[r>>1]=a,r+=2}return A[r>>1]=0,r-t}function S(n){return 2*n.length}function R(n,r){for(var e=0,t=\"\";!(e>=r/4);){var o=_[n+4*e>>2];if(0==o)break;if(++e,o>=65536){var i=o-65536;t+=String.fromCharCode(55296|i>>10,56320|1023&i)}else t+=String.fromCharCode(o)}return t}function I(n,r,e){if(void 0===e&&(e=2147483647),e<4)return 0;for(var t=r,o=t+e-4,i=0;i<n.length;++i){var a=n.charCodeAt(i);if(a>=55296&&a<=57343&&(a=65536+((1023&a)<<10)|1023&n.charCodeAt(++i)),_[r>>2]=a,(r+=4)+4>o)break}return _[r>>2]=0,r-t}function U(n){for(var r=0,e=0;e<n.length;++e){var t=n.charCodeAt(e);t>=55296&&t<=57343&&++e,r+=4}return r}r.INITIAL_MEMORY;var O,x=[],j=[],V=[],H=[];function D(){return p||!1}function B(n){x.unshift(n)}function M(n){H.unshift(n)}var q,z,G=0,L=null,N=null;function J(n){throw r.onAbort&&r.onAbort(n),d(n+=\"\"),h=!0,v=1,n=\"abort(\"+n+\"). Build with -s ASSERTIONS=1 for more info.\",new WebAssembly.RuntimeError(n)}function X(n){return n.startsWith(\"data:application/octet-stream;base64,\")}function K(n){return n.startsWith(\"file://\")}function Y(n){try{if(n==q&&s)return new Uint8Array(s);if(i)return i(n);throw\"both async and sync fetching of the wasm failed\"}catch(n){J(n)}}function Z(n){for(;n.length>0;){var e=n.shift();if(\"function\"!=typeof e){var t=e.func;\"number\"==typeof t?void 0===e.arg?O.get(t)():O.get(t)(e.arg):t(void 0===e.arg?null:e.arg)}else e(r)}}function $(n){switch(n){case 1:return 0;case 2:return 1;case 4:return 2;case 8:return 3;default:throw new TypeError(\"Unknown type size: \"+n)}}r.preloadedImages={},r.preloadedAudios={},X(q=\"bundle.wasm\")||(z=q,q=r.locateFile?r.locateFile(z,l):l+z);var Q=void 0;function nn(n){for(var r=\"\",e=n;b[e];)r+=Q[b[e++]];return r}var rn={},en={},tn={};function on(n){if(void 0===n)return\"_unknown\";var r=(n=n.replace(/[^a-zA-Z0-9_]/g,\"$\")).charCodeAt(0);return r>=48&&r<=57?\"_\"+n:n}function an(n,r){var e=function(n,r){n=on(n);var e=function(){return r.apply(this,arguments)};try{Object.defineProperty(e,\"name\",{value:n})}catch(n){}return e}(r,function(n){this.name=r,this.message=n;var e=new Error(n).stack;void 0!==e&&(this.stack=this.toString()+\"\\n\"+e.replace(/^Error(:[^\\n]*)?\\n/,\"\"))});return e.prototype=Object.create(n.prototype),e.prototype.constructor=e,e.prototype.toString=function(){return void 0===this.message?this.name:this.name+\": \"+this.message},e}var un=void 0;function fn(n){throw new un(n)}var cn=void 0;function ln(n){throw new cn(n)}function sn(n,r,e){if(e=e||{},!(\"argPackAdvance\"in r))throw new TypeError(\"registerType registeredInstance requires argPackAdvance\");var t=r.name;if(n||fn('type \"'+t+'\" must have a positive integer typeid pointer'),en.hasOwnProperty(n)){if(e.ignoreDuplicateRegistrations)return;fn(\"Cannot register type '\"+t+\"' twice\")}if(en[n]=r,delete tn[n],rn.hasOwnProperty(n)){var o=rn[n];delete rn[n],o.forEach(function(n){n()})}}var dn=[],vn=[{},{value:void 0},{value:null},{value:!0},{value:!1}];function hn(n){n>4&&0===--vn[n].refcount&&(vn[n]=void 0,dn.push(n))}function yn(n){switch(n){case void 0:return 1;case null:return 2;case!0:return 3;case!1:return 4;default:var r=dn.length?dn.pop():vn.length;return vn[r]={refcount:1,value:n},r}}function mn(n){return this.fromWireType(C[n>>2])}function gn(n){if(null===n)return\"null\";var r=t(n);return\"object\"===r||\"array\"===r||\"function\"===r?n.toString():\"\"+n}function wn(n,r){switch(r){case 2:return function(n){return this.fromWireType(P[n>>2])};case 3:return function(n){return this.fromWireType(E[n>>3])};default:throw new TypeError(\"Unknown float type: \"+n)}}function bn(n){for(;n.length;){var r=n.pop();n.pop()(r)}}var An=void 0;function Tn(n){var r=pn(n),e=nn(r);return xn(r),e}function _n(n,r,e){switch(r){case 0:return e?function(n){return w[n]}:function(n){return b[n]};case 1:return e?function(n){return A[n>>1]}:function(n){return T[n>>1]};case 2:return e?function(n){return _[n>>2]}:function(n){return C[n>>2]};default:throw new TypeError(\"Unknown integer type: \"+n)}}function Cn(n){return n||fn(\"Cannot use deleted val. handle = \"+n),vn[n].value}function Pn(n,r){var e=en[n];return void 0===e&&fn(r+\" has unknown type \"+Tn(n)),e}function En(n,r){for(var e=new Array(n),t=0;t<n;++t)e[t]=Pn(_[(r>>2)+t],\"parameter \"+t);return e}var kn={};function Fn(n){var r=kn[n];return void 0===r?nn(n):r}var Wn=[];function Sn(){return\"object\"===(\"undefined\"==typeof globalThis?\"undefined\":t(globalThis))?globalThis:\"object\"===(\"undefined\"==typeof window?\"undefined\":t(window))?window:\"object\"===(\"undefined\"==typeof self?\"undefined\":t(self))?self:Function(\"return this\")()}var Rn={};!function(){for(var n=new Array(256),r=0;r<256;++r)n[r]=String.fromCharCode(r);Q=n}(),un=r.BindingError=an(Error,\"BindingError\"),cn=r.InternalError=an(Error,\"InternalError\"),r.count_emval_handles=function(){for(var n=0,r=5;r<vn.length;++r)void 0!==vn[r]&&++n;return n},r.get_first_emval=function(){for(var n=5;n<vn.length;++n)if(void 0!==vn[n])return vn[n];return null},An=r.UnboundTypeError=an(Error,\"UnboundTypeError\");var In,Un={t:function(n,r,e,t,o){},w:function(n,r,e,t,o){var i=$(e);sn(n,{name:r=nn(r),fromWireType:function(n){return!!n},toWireType:function(n,r){return r?t:o},argPackAdvance:8,readValueFromPointer:function(n){var t;if(1===e)t=w;else if(2===e)t=A;else{if(4!==e)throw new TypeError(\"Unknown boolean type size: \"+r);t=_}return this.fromWireType(t[n>>i])},destructorFunction:null})},v:function(n,r){sn(n,{name:r=nn(r),fromWireType:function(n){var r=vn[n].value;return hn(n),r},toWireType:function(n,r){return yn(r)},argPackAdvance:8,readValueFromPointer:mn,destructorFunction:null})},o:function(n,r,e){var t=$(e);sn(n,{name:r=nn(r),fromWireType:function(n){return n},toWireType:function(n,r){if(\"number\"!=typeof r&&\"boolean\"!=typeof r)throw new TypeError('Cannot convert \"'+gn(r)+'\" to '+this.name);return r},argPackAdvance:8,readValueFromPointer:wn(r,t),destructorFunction:null})},l:function(n,e,t,o,i,a){var u=function(n,r){for(var e=[],t=0;t<n;t++)e.push(_[(r>>2)+t]);return e}(e,t);n=nn(n),i=function(n,e){var t=(n=nn(n)).includes(\"j\")?function(n,e){var t=[];return function(){t.length=arguments.length;for(var o=0;o<arguments.length;o++)t[o]=arguments[o];return function(n,e,t){return n.includes(\"j\")?function(n,e,t){var o=r[\"dynCall_\"+n];return t&&t.length?o.apply(null,[e].concat(t)):o.call(null,e)}(n,e,t):O.get(e).apply(null,t)}(n,e,t)}}(n,e):O.get(e);return\"function\"!=typeof t&&fn(\"unknown function pointer with signature \"+n+\": \"+e),t}(o,i),function(n,e,t){r.hasOwnProperty(n)?((void 0===t||void 0!==r[n].overloadTable&&void 0!==r[n].overloadTable[t])&&fn(\"Cannot register public name '\"+n+\"' twice\"),function(n,r,e){if(void 0===n[r].overloadTable){var t=n[r];n[r]=function(){return n[r].overloadTable.hasOwnProperty(arguments.length)||fn(\"Function '\"+e+\"' called with an invalid number of arguments (\"+arguments.length+\") - expects one of (\"+n[r].overloadTable+\")!\"),n[r].overloadTable[arguments.length].apply(this,arguments)},n[r].overloadTable=[],n[r].overloadTable[t.argCount]=t}}(r,n,n),r.hasOwnProperty(t)&&fn(\"Cannot register multiple overloads of a function with the same number of arguments (\"+t+\")!\"),r[n].overloadTable[t]=e):(r[n]=e,void 0!==t&&(r[n].numArguments=t))}(n,function(){!function(n,r){var e=[],t={};throw r.forEach(function n(r){t[r]||en[r]||(tn[r]?tn[r].forEach(n):(e.push(r),t[r]=!0))}),new An(n+\": \"+e.map(Tn).join([\", \"]))}(\"Cannot call \"+n+\" due to unbound types\",u)},e-1),function(n,r,e){function t(r){var t=e(r);t.length!==n.length&&ln(\"Mismatched type converter count\");for(var o=0;o<n.length;++o)sn(n[o],t[o])}n.forEach(function(n){tn[n]=r});var o=new Array(r.length),i=[],a=0;r.forEach(function(n,r){en.hasOwnProperty(n)?o[r]=en[n]:(i.push(n),rn.hasOwnProperty(n)||(rn[n]=[]),rn[n].push(function(){o[r]=en[n],++a===i.length&&t(o)}))}),0===i.length&&t(o)}([],u,function(t){var o=[t[0],null].concat(t.slice(1));return function(n,e,t){r.hasOwnProperty(n)||ln(\"Replacing nonexistant public symbol\"),void 0!==r[n].overloadTable&&void 0!==t?r[n].overloadTable[t]=e:(r[n]=e,r[n].argCount=t)}(n,function(n,r,e,t,o){for(var i=r[0],a=r[1],u=r.slice(2),f=u.length,c=!1,l=1;l<r.length;++l)if(null!==r[l]&&void 0===r[l].destructorFunction){c=!0;break}var s=function(){arguments.length!==f&&fn(\"function \"+n+\" called with \"+arguments.length+\" arguments, expected \"+f+\" args!\");var r=c?[]:null,e=[];a&&e.push(a.toWireType(r,this));for(var l=0;l<f;l++)e.push(u[l].toWireType(r,arguments[l]));var s=t.apply(null,[o].concat(e));if(c)bn(r);else{var d=0;for(a&&(null!==a.destructorFunction&&a.destructorFunction(e[d]),d++),l=0;l<f;l++)null!==u[l].destructorFunction&&u[l].destructorFunction(e[d]),d++}if(\"void\"!==i.name)return i.fromWireType(s)};try{Object.defineProperty(s,\"name\",{value:on(n)})}catch(n){}return s}(n,o,0,i,a),e-1),[]})},d:function(n,r,e,t,o){r=nn(r),-1===o&&(o=4294967295);var i=$(e),a=function(n){return n};if(0===t){var u=32-8*e;a=function(n){return n<<u>>>u}}var f=r.includes(\"unsigned\");sn(n,{name:r,fromWireType:a,toWireType:function(n,e){if(\"number\"!=typeof e&&\"boolean\"!=typeof e)throw new TypeError('Cannot convert \"'+gn(e)+'\" to '+this.name);if(e<t||e>o)throw new TypeError('Passing a number \"'+gn(e)+'\" from JS side to C/C++ side to an argument of type \"'+r+'\", which is outside the valid range ['+t+\", \"+o+\"]!\");return f?e>>>0:0|e},argPackAdvance:8,readValueFromPointer:_n(r,i,0!==t),destructorFunction:null})},c:function(n,r,e){var t=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array][r];function o(n){var r=C,e=r[n>>=2],o=r[n+1];return new t(g,o,e)}sn(n,{name:e=nn(e),fromWireType:o,argPackAdvance:8,readValueFromPointer:o},{ignoreDuplicateRegistrations:!0})},p:function(n,r){var e=\"std::string\"===(r=nn(r));sn(n,{name:r,fromWireType:function(n){var r,t=C[n>>2];if(e)for(var o=n+4,i=0;i<=t;++i){var a=n+4+i;if(i==t||0==b[a]){var u=m(o,a-o);void 0===r?r=u:(r+=String.fromCharCode(0),r+=u),o=a+1}}else{var f=new Array(t);for(i=0;i<t;++i)f[i]=String.fromCharCode(b[n+4+i]);r=f.join(\"\")}return xn(n),r},toWireType:function(n,r){var t;r instanceof ArrayBuffer&&(r=new Uint8Array(r));var o=\"string\"==typeof r;o||r instanceof Uint8Array||r instanceof Uint8ClampedArray||r instanceof Int8Array||fn(\"Cannot pass non-string to std::string\"),t=e&&o?function(){return function(n){for(var r=0,e=0;e<n.length;++e){var t=n.charCodeAt(e);t>=55296&&t<=57343&&(t=65536+((1023&t)<<10)|1023&n.charCodeAt(++e)),t<=127?++r:r+=t<=2047?2:t<=65535?3:4}return r}(r)}:function(){return r.length};var i=t(),a=On(4+i+1);if(C[a>>2]=i,e&&o)!function(n,r,e){!function(n,r,e,t){if(!(t>0))return 0;for(var o=e+t-1,i=0;i<n.length;++i){var a=n.charCodeAt(i);if(a>=55296&&a<=57343&&(a=65536+((1023&a)<<10)|1023&n.charCodeAt(++i)),a<=127){if(e>=o)break;r[e++]=a}else if(a<=2047){if(e+1>=o)break;r[e++]=192|a>>6,r[e++]=128|63&a}else if(a<=65535){if(e+2>=o)break;r[e++]=224|a>>12,r[e++]=128|a>>6&63,r[e++]=128|63&a}else{if(e+3>=o)break;r[e++]=240|a>>18,r[e++]=128|a>>12&63,r[e++]=128|a>>6&63,r[e++]=128|63&a}}r[e]=0}(n,b,r,e)}(r,a+4,i+1);else if(o)for(var u=0;u<i;++u){var f=r.charCodeAt(u);f>255&&(xn(a),fn(\"String has UTF-16 code units that do not fit in 8 bits\")),b[a+4+u]=f}else for(u=0;u<i;++u)b[a+4+u]=r[u];return null!==n&&n.push(xn,a),a},argPackAdvance:8,readValueFromPointer:mn,destructorFunction:function(n){xn(n)}})},j:function(n,r,e){var t,o,i,a,u;e=nn(e),2===r?(t=F,o=W,a=S,i=function(){return T},u=1):4===r&&(t=R,o=I,a=U,i=function(){return C},u=2),sn(n,{name:e,fromWireType:function(n){for(var e,o=C[n>>2],a=i(),f=n+4,c=0;c<=o;++c){var l=n+4+c*r;if(c==o||0==a[l>>u]){var s=t(f,l-f);void 0===e?e=s:(e+=String.fromCharCode(0),e+=s),f=l+r}}return xn(n),e},toWireType:function(n,t){\"string\"!=typeof t&&fn(\"Cannot pass non-string to C++ string type \"+e);var i=a(t),f=On(4+i+r);return C[f>>2]=i>>u,o(t,f+4,i+r),null!==n&&n.push(xn,f),f},argPackAdvance:8,readValueFromPointer:mn,destructorFunction:function(n){xn(n)}})},x:function(n,r){sn(n,{isVoid:!0,name:r=nn(r),argPackAdvance:0,fromWireType:function(){},toWireType:function(n,r){}})},g:function(n,r,e){n=Cn(n),r=Pn(r,\"emval::as\");var t=[],o=yn(t);return _[e>>2]=o,r.toWireType(t,n)},D:function(n,r,e,t){n=Cn(n);for(var o=En(r,e),i=new Array(r),a=0;a<r;++a){var u=o[a];i[a]=u.readValueFromPointer(t),t+=u.argPackAdvance}return yn(n.apply(void 0,i))},b:function(n,r,e,t,o){return(n=Wn[n])(r=Cn(r),e=Fn(e),function(n){var r=[];return _[n>>2]=yn(r),r}(t),o)},f:function(n,r,e,t){(n=Wn[n])(r=Cn(r),e=Fn(e),null,t)},m:hn,y:function(n){return 0===n?yn(Sn()):(n=Fn(n),yn(Sn()[n]))},a:function(n,r){var e=En(n,r),t=e[0],o=e.slice(1);return function(){var n=Wn.length;return Wn.push(function(n,r,e,i){for(var a=[],u=i,f=0;f<o.length;f++){var c=o[f],l=c.readValueFromPointer(u);a.push(l),u+=c.argPackAdvance}var s=n[r].apply(n,a);for(f=0;f<o.length;f++)o[f].deleteObject&&o[f].deleteObject(a[f]);if(!t.isVoid)return t.toWireType(e,s)}),n}()},r:function(n){return n=Fn(n),yn(r[n])},i:function(n,r){return yn((n=Cn(n))[r=Cn(r)])},h:function(n){n>4&&(vn[n].refcount+=1)},q:function(n,r){return(n=Cn(n))instanceof Cn(r)},s:function(n,e,t,o){n=Cn(n);var i=Rn[e];return i||(i=function(n){return function(e,t,o){for(var i=[],a=0;a<n;++a){var u=Pn(r.HEAP32[(t>>2)+a],\"parameter \"+a),f=u.readValueFromPointer(o);o+=u.argPackAdvance,i.push(f)}return yn(new(Function.prototype.bind.apply(e,[null].concat(i))))}}(e),Rn[e]=i),i(n,t,o)},C:function(){return yn([])},z:function(n){return yn(Fn(n))},E:function(){return yn({})},A:function(n){bn(vn[n].value),hn(n)},e:function(n,r,e){n=Cn(n),r=Cn(r),e=Cn(e),n[r]=e},k:function(n,r){return yn((n=Pn(n,\"_emval_take_value\")).readValueFromPointer(r))},B:function(n){return yn(t(n=Cn(n)))},n:function(){J()},u:function(n){b.length,J(\"OOM\")}},On=(function(){var n={a:Un,env:{}};function e(n,e){var t=n.exports;r.asm=t,function(n){g=n,r.HEAP8=w=new Int8Array(n),r.HEAP16=A=new Int16Array(n),r.HEAP32=_=new Int32Array(n),r.HEAPU8=b=new Uint8Array(n),r.HEAPU16=T=new Uint16Array(n),r.HEAPU32=C=new Uint32Array(n),r.HEAPF32=P=new Float32Array(n),r.HEAPF64=E=new Float64Array(n)}(r.asm.F.buffer),O=r.asm.J,function(n){j.unshift(n)}(r.asm.G),function(){if(G--,r.monitorRunDependencies&&r.monitorRunDependencies(G),0==G&&(null!==L&&(clearInterval(L),L=null),N)){var n=N;N=null,n()}}()}function t(n){e(n.instance)}function i(r){return function(){if(!s&&(f||c)){if(\"function\"==typeof fetch&&!K(q))return fetch(q,{credentials:\"same-origin\"}).then(function(n){if(!n.ok)throw\"failed to load wasm binary file at '\"+q+\"'\";return n.arrayBuffer()}).catch(function(){return Y(q)});if(o)return new Promise(function(n,r){o(q,function(r){n(new Uint8Array(r))},r)})}return Promise.resolve().then(function(){return Y(q)})}().then(function(r){return WebAssembly.instantiate(r,n)}).then(function(n){return n}).then(r,function(n){d(\"failed to asynchronously prepare wasm: \"+n),J(n)})}if(G++,r.monitorRunDependencies&&r.monitorRunDependencies(G),r.instantiateWasm)try{return r.instantiateWasm(n,e)}catch(n){return d(\"Module.instantiateWasm callback failed with error: \"+n),!1}s||\"function\"!=typeof WebAssembly.instantiateStreaming||X(q)||K(q)||\"function\"!=typeof fetch?i(t):fetch(q,{credentials:\"same-origin\"}).then(function(r){return WebAssembly.instantiateStreaming(r,n).then(t,function(n){return d(\"wasm streaming compile failed: \"+n),d(\"falling back to ArrayBuffer instantiation\"),i(t)})})}(),r.___wasm_call_ctors=function(){return(r.___wasm_call_ctors=r.asm.G).apply(null,arguments)},r._malloc=function(){return(On=r._malloc=r.asm.H).apply(null,arguments)}),xn=(r._main=function(){return(r._main=r.asm.I).apply(null,arguments)},r.___getTypeName=function(){return(r.___getTypeName=r.asm.K).apply(null,arguments)},r.___embind_register_native_and_builtin_types=function(){return(r.___embind_register_native_and_builtin_types=r.asm.L).apply(null,arguments)},r._free=function(){return(xn=r._free=r.asm.M).apply(null,arguments)});function jn(n){this.name=\"ExitStatus\",this.message=\"Program terminated with exit(\"+n+\")\",this.status=n}function Vn(n){function e(){In||(In=!0,r.calledRun=!0,h||(Z(j),Z(V),r.onRuntimeInitialized&&r.onRuntimeInitialized(),Hn&&function(n){var e=r._main;try{var t=e(0,0);return function(n){v=n,D(),function(n){v=n,D()||(r.onExit&&r.onExit(n),h=!0),u(n,new jn(n))}(n)}(t),t}catch(n){return function(n){if(n instanceof jn||\"unwind\"==n)return v;d(\"exception thrown: \"+n),u(1,n)}(n)}}(n),function(){if(r.postRun)for(\"function\"==typeof r.postRun&&(r.postRun=[r.postRun]);r.postRun.length;)M(r.postRun.shift());Z(H)}()))}n=n||a,G>0||(function(){if(r.preRun)for(\"function\"==typeof r.preRun&&(r.preRun=[r.preRun]);r.preRun.length;)B(r.preRun.shift());Z(x)}(),G>0||(r.setStatus?(r.setStatus(\"Running...\"),setTimeout(function(){setTimeout(function(){r.setStatus(\"\")},1),e()},1)):e()))}if(N=function n(){In||Vn(),In||(N=n)},r.run=Vn,r.preInit)for(\"function\"==typeof r.preInit&&(r.preInit=[r.preInit]);r.preInit.length>0;)r.preInit.pop()();var Hn=!0;return r.noInitialRun&&(Hn=!1),Vn(),r}e.d(r,{A:()=>o})}}]);\n  } catch (err) {\n    self.postMessage({ type: 'error', code: 'INITIALIZATION_FAILED', msg: String(err && err.message || err) });\n    return;\n  }\n\n  var wasmFactory;\n  try {\n    wasmFactory = requireFactory(458).A;\n  } catch (err) {\n    self.postMessage({ type: 'error', code: 'INITIALIZATION_FAILED', msg: 'wasmLoader export A: ' + (err && err.message || err) });\n    return;\n  }\n\n  var moduleInstance = null;\n  var socket = null;\n\n  function boot() {\n    return new Promise(function (resolve, reject) {\n      var settled = false;\n      moduleInstance = wasmFactory({\n        wasmBinary: self.__ONYX_BOT_WASM_BYTES__,\n        locateFile: function (name) {\n          return 'onyx-bot-embedded.wasm';\n        },\n        print: function (msg) { self.postMessage({ type: 'log', msg: '[WASM] ' + msg }); },\n        printErr: function (msg) {\n          if (!settled) {\n            settled = true;\n            reject(new Error(String(msg)));\n          }\n        },\n        onRuntimeInitialized: function () {\n          if (!settled) {\n            settled = true;\n            resolve(moduleInstance);\n          }\n        }\n      });\n    });\n  }\n\n  function connect(url) {\n    if (!moduleInstance || typeof moduleInstance.create !== 'function') {\n      throw new Error('WASM create() missing');\n    }\n    if (!/^wss:\\/\\/[a-z0-9-]+\\.senpa\\.io:\\d{2,5}\\?/.test(url || '')) {\n      throw new Error('[FFA] Invalid codec URL: ' + url);\n    }\n    socket = moduleInstance.create(\n      url,\n      function () { self.postMessage({ type: 'open' }); },\n      function (code, reason, wasClean) {\n        self.postMessage({\n          type: 'close',\n          code: typeof code === 'number' ? code : (code && code.code),\n          reason: String(reason || (code && code.reason) || ''),\n          wasClean: !!(wasClean || (code && code.wasClean))\n        });\n      },\n      function (data) {\n        var buf;\n        if (data && data.buffer && data.byteLength != null) {\n          buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);\n        } else if (data instanceof ArrayBuffer) {\n          buf = data.slice(0);\n        } else {\n          return;\n        }\n        try {\n          protocol.receive(buf);\n          var track = self.CanvasCaptureMediaStreamTrack;\n          if (track && track.contextBufferFactory) {\n            moduleInstance._alloc(9, track.contextBufferFactory);\n            track.contextBufferFactory = null;\n          }\n        } catch (err) {\n          self.postMessage({type:'error', msg:'Protocol: ' + err.message}); closeSock();\n        }\n      },\n      function (err) {\n        var msg = 'ws error';\n        if (err && err.message) msg = err.message;\n        else if (err && err.type) msg = 'WebSocket ' + err.type;\n        else if (err != null) msg = String(err);\n        self.postMessage({ type: 'error', code: 'WS_ERROR', msg: msg });\n      }\n    );\n  }\n\n  function send(bytes) {\n    if (!socket) return;\n    if (bytes instanceof ArrayBuffer) socket.send(new Uint8Array(bytes));\n    else socket.send(bytes);\n  }\n\n  function closeSock() {\n    try { if (socket && socket.close) socket.close(); } catch (_) {}\n    socket = null;\n  }\n\n  var ready = boot();\n  ready.then(function () {\n    self.postMessage({ type: 'codec-ready' });\n  }).catch(function (err) {\n    self.postMessage({ type: 'error', code: 'INITIALIZATION_FAILED', msg: String(err && err.message || err) });\n  });\n\n  self.onmessage = function (ev) {\n    var msg = ev.data || {};\n    if (msg.type === 'connect') {\n      ready.then(function () {\n        protocol = new self.OnyxBotProtocol(send, function (event) { self.postMessage(event); },\n          function (kind, bytes) { moduleInstance._alloc(kind, bytes); });\n        protocol.name = String(msg.name || 'Bot').slice(0, 24);\n        protocol.token = msg.token || 'null';\n        connect(msg.url);\n      }).catch(function (err) {\n        self.postMessage({ type: 'error', code: 'INITIALIZATION_FAILED', msg: String(err && err.message || err) });\n      });\n      return;\n    }\n    if (protocol && msg.type === 'spawn') { protocol.spawn(); return; }\n    if (protocol && msg.type === 'move') { protocol.move(msg.x, msg.y); return; }\n    if (protocol && msg.type === 'split') { protocol.action(22); return; }\n    if (protocol && msg.type === 'feed') { protocol.action(23); return; }\n    if (protocol && msg.type === 'ping') { if (protocol.ready) send(new Uint8Array([30])); return; }\n    if (msg.type === 'send') {\n      send(msg.data);\n      return;\n    }\n    if (msg.type === 'close') {\n      closeSock();\n    }\n  };\n})();\n";
    var panelSource = "/* Independent bot controls; never replace WebSocket, SC, WASM or game keyboard handlers. */\n(function () {\n  'use strict';\n  if (window.ONYXBots) return;\n  const scriptBase = new URL(window.__KATERONYX_BASE_URL || '.', location.href);\n  const state = {bots: [], generation: 0, paused: false, target: null, host: '', logs: [], spawnWanted: false};\n  const host = document.createElement('div'); host.id = 'onyx-bots-panel';\n  Object.assign(host.style, {position:'fixed', right:'16px', top:'70px', zIndex:'100000', maxWidth:'calc(100vw - 24px)'});\n  const root = host.attachShadow({mode:'open'});\n  root.innerHTML = `<style>\n  :host{font:12px Arial,sans-serif;color:#c8cbce}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit;background:#101214;border:1px solid #303438;border-radius:4px;min-height:34px;padding:8px}button{cursor:pointer}button:hover{background:#252a30;border-color:#6a7480}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #7dd3fc}button:disabled{opacity:.4;cursor:default}section{width:380px;max-width:calc(100vw - 24px);background:#0a0c0eed;border:1px solid #303438;border-radius:8px;box-shadow:0 12px 45px #0009;overflow:hidden}header{display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid #272b30}header strong{flex:1;font-size:13px}header small{color:#929ba4;font-size:10px}main{padding:12px;max-height:calc(100vh - 155px);overflow:auto}nav,.row,.actions{display:flex;gap:8px;margin-bottom:12px}nav button{flex:1;font-size:10px}nav button[aria-selected=true]{border-color:#8294a8}label{display:block;color:#909aa5;font-size:10px;line-height:1.5}label input:not([type=checkbox]),label select{width:100%;display:block;margin-top:4px}label.grow{flex:1}.count{width:72px}.checks{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}.checks label{display:flex;align-items:center;gap:5px}input[type=checkbox]{min-height:0;accent-color:#b1c6d9}.actions button{flex:1}footer{border:1px solid #282c30;border-radius:4px;padding:9px;color:#93a3b4;overflow-wrap:anywhere}.hint{font-size:11px;color:#9ba6b1;line-height:1.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px monospace;max-height:350px;overflow:auto}.bot{padding:10px 0;border-bottom:1px solid #292e33} [hidden]{display:none!important}\n  </style><section><header><strong>\ud83e\udd16 GAME BOTS \u00b7 2.0.6</strong><small id=\"counts\">0 total | 0 ready | 0 alive</small><button id=\"collapse\" aria-label=\"Collapse panel\">\u2212</button></header><main>\n  <nav><button data-tab=\"controls\" aria-selected=\"true\">CONTROLS</button><button data-tab=\"active\">ACTIVE BOTS</button><button data-tab=\"console\">CONSOLE</button></nav>\n  <div id=\"controls\"><div class=\"row\"><label class=\"grow\">NAME<input id=\"name\" maxlength=\"24\" value=\"Bot\"></label><label class=\"count\">COUNT<input id=\"count\" type=\"number\" min=\"1\" max=\"5\" value=\"2\"></label></div>\n  <label>SERVER \u00b7 SAME AS GAME<input id=\"server\" readonly></label><p class=\"hint\">DUAL \u00b7 FFA \u00b7 MEGASPLIT<br>Count = connections. DUAL slots come from the server.</p>\n  <div class=\"row\"><label class=\"grow\">TARGET<select id=\"target\"><option value=\"mouse\">Mouse</option><option value=\"hold\">Hold current point</option></select></label></div>\n  <label>PANEL OPACITY<input id=\"opacity\" type=\"range\" min=\"35\" max=\"100\" value=\"100\"></label>\n  <div class=\"row\"><label class=\"grow\">SPAWN KEY<input id=\"spawnKey\" readonly placeholder=\"Click to bind\"></label><label class=\"grow\">SPLIT KEY<input id=\"splitKey\" readonly placeholder=\"Click to bind\"></label><label class=\"grow\">MASS KEY<input id=\"feedKey\" readonly placeholder=\"Click to bind\"></label></div>\n  <div class=\"actions\"><button id=\"connect\">\u26a1 Connect</button><button id=\"spawn\">\u25b6 Spawn</button><button id=\"split\">\u2702 Split</button><button id=\"feed\">\u25cf Mass</button></div>\n  <div class=\"checks\"><label><input id=\"auto\" type=\"checkbox\">AUTO SPAWN</label><label><input id=\"respawn\" type=\"checkbox\">RESPAWN</label><label><input id=\"follow\" type=\"checkbox\" checked>FOLLOW</label></div>\n  <div class=\"actions\"><button id=\"pause\">\u2161 Pause</button><button id=\"stop\">\u25a0 Stop All</button></div></div>\n  <div id=\"active\" hidden></div><div id=\"console\" hidden><button id=\"copy\">Copy diagnostics</button><pre id=\"log\"></pre></div>\n  <footer id=\"status\">Ready \u2014 select a server and press Connect.</footer></main></section>`;\n  const $ = id => root.getElementById(id), keys = {};\n  function log(message) {\n    state.logs.push(new Date().toLocaleTimeString() + ' ' + message); state.logs = state.logs.slice(-100);\n    $('log').textContent = state.logs.join('\\n'); $('status').textContent = message;\n  }\n  function selected() { const el = document.getElementById('servers'); return window.ONYXServers && window.ONYXServers.find(el && el.value); }\n  function render() {\n    $('counts').textContent = `${state.bots.length} total | ${state.bots.filter(b=>b.ready).length} ready | ${state.bots.reduce((n,b)=>n+b.alive.length,0)} alive`;\n    $('active').replaceChildren(...state.bots.map(b => { const el = document.createElement('div'); el.className='bot'; el.textContent=`${b.name} \u00b7 ${b.status} \u00b7 ${b.alive.length}/${b.slots} slots alive`; return el; }));\n    for (const id of ['spawn','split','feed']) $(id).disabled = state.paused || !state.bots.some(b=>b.ready);\n    $('connect').disabled = state.bots.some(b=>b.worker);\n  }\n  function dispose(b, reason) {\n    clearTimeout(b.timer); clearTimeout(b.respawnTimer); clearTimeout(b.spawnTimer);\n    if (b.worker) { b.worker.postMessage({type:'close'}); b.worker.terminate(); b.worker=null; }\n    b.ready=false; b.alive=[]; b.status=reason; render();\n  }\n  function stop(reason='Stopped') { state.generation++; state.bots.forEach(b=>dispose(b,reason)); state.spawnWanted=false; state.paused=false; $('pause').textContent='\u2161 Pause'; render(); log(reason); }\n  function spawnBot(b) {\n    if (!b.ready || !b.worker || state.paused || b.spawnTimer || b.alive.length === b.slots) return;\n    b.worker.postMessage({type:'move',...(state.target || {x:(b.border/2)|0,y:(b.border/2)|0})});\n    b.worker.postMessage({type:'spawn'}); b.status='Waiting for own cells';\n    b.spawnTimer=setTimeout(()=>{ b.spawnTimer=null; if(b.alive.length<b.slots) { log(b.name+': spawn not confirmed after 8s; reconnect to retry.'); b.status='Spawn unconfirmed'; render(); } },8000);\n  }\n  function action(type) {\n    if (state.paused) return;\n    if(type==='spawn') state.spawnWanted=true;\n    state.bots.forEach(b=>{if(b.worker&&b.ready) {if(type==='spawn') spawnBot(b); else b.worker.postMessage({type});}});\n  }\n  function launch(b, entry, generation) {\n    if(generation!==state.generation) return;\n    let worker;\n    try { worker = new Worker(window.__ONYX_BOT_WORKER_URL__ || new URL('ffa/onyx-bot-worker.js',scriptBase)); } catch(e) { dispose(b,'Worker failed'); log(e.message); return; }\n    b.worker=worker; b.status='Loading codec';\n    b.timer=setTimeout(()=>{dispose(b,'Connection timeout');log(b.name+': no ready handshake after 15s.');},15000);\n    worker.onerror=event=>{const reason='Worker error: '+(event.message||'Browser did not expose details')+' (line '+(event.lineno||0)+')';dispose(b,reason);log(b.name+': '+reason);};\n    worker.onmessage=event=>{\n      if(generation!==state.generation || b.worker!==worker) return;\n      const m=event.data;\n      if(m.type==='worker-loaded') {b.status='Initializing WASM';log(b.name+': worker loaded; initializing WASM.');}\n      if(m.type==='codec-ready') { b.status='Connecting'; worker.postMessage({type:'connect',url:window.ONYXFfaAdapter.wsUrl(entry.host),name:b.name,token:window.ONYXFfaAdapter.readJwt()}); }\n      if(m.type==='open') b.status='Authenticating';\n      if(m.type==='ready') {clearTimeout(b.timer);b.ready=true;b.slots=m.slots;b.border=m.border;b.status='Ready';log(b.name+': ready, '+m.slots+' player slots.');if($('auto').checked||state.spawnWanted) spawnBot(b);}\n      if(m.type==='world') {\n        const previous=b.status+':'+b.alive.join(',');\n        b.alive=m.alive;\n        if(b.alive.length===b.slots){clearTimeout(b.spawnTimer);b.spawnTimer=null;}\n        b.status=b.alive.length?'Alive':b.spawnTimer?'Spawning':'Ready';\n        if(m.died.length && $('respawn').checked && !state.paused && !b.respawnTimer) b.respawnTimer=setTimeout(()=>{b.respawnTimer=null;spawnBot(b);},1500);\n        if(previous===b.status+':'+b.alive.join(','))return;\n      }\n      if(m.type==='blocked'||m.type==='error'||m.type==='close') {const reason=m.reason||m.msg||('Closed '+m.code);dispose(b,reason);log(b.name+': '+reason);}\n      render();\n    }; render();\n  }\n  $('connect').onclick=()=>{\n    const entry=selected(); if(!entry || !window.ONYXFfaAdapter) return log('Select a supported game server first.');\n    stop('Starting '+entry.mode_name); state.bots=[];state.host=entry.host;state.target=null;\n    const count=Math.min(5,Math.max(1,Math.trunc(Number($('count').value)||1)));$('count').value=count;\n    const generation=state.generation;\n    for(let i=0;i<count;i++) {const b={name:($('name').value.trim()||'Bot')+' '+(i+1),ready:false,slots:0,alive:[],status:'Queued',worker:null};state.bots.push(b);b.timer=setTimeout(()=>launch(b,entry,generation),i*800);}\n    render();\n  };\n  for(const id of ['spawn','split','feed']) $(id).onclick=()=>action(id);\n  $('stop').onclick=()=>stop();\n  $('pause').onclick=()=>{state.paused=!state.paused;$('pause').textContent=state.paused?'\u25b6 Resume':'\u2161 Pause';log(state.paused?'Paused controls; connections remain open.':'Controls resumed.');render();};\n  $('collapse').onclick=()=>{const main=root.querySelector('main');main.hidden=!main.hidden;$('collapse').textContent=main.hidden?'+':'\u2212';};\n  $('opacity').oninput=()=>host.style.opacity=Number($('opacity').value)/100;\n  root.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>{for(const id of ['controls','active','console']) $(id).hidden=id!==btn.dataset.tab;root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===btn)));});\n  $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(state.logs.join('\\n'));$('copy').textContent='Copied';}catch(_){log('Copy unavailable; select the console text.');}};\n  for(const id of ['spawn','split','feed']) {\n    $(id+'Key').onkeydown=e=>{e.preventDefault();e.stopPropagation(); if(['Tab','ShiftLeft','ShiftRight','ControlLeft','AltLeft','MetaLeft'].includes(e.code))return;\n      if(e.code==='Escape'||e.code==='Backspace'||e.code==='Delete'){delete keys[id];$(id+'Key').value='';return;}\n      for(const other of Object.keys(keys))if(keys[other]===e.code){delete keys[other];$(other+'Key').value='';}\n      keys[id]=e.code;$(id+'Key').value=e.code;\n    };\n  }\n  window.addEventListener('keydown',e=>{\n    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.composedPath().includes(host)||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)||e.target.isContentEditable)return;\n    const id=Object.keys(keys).find(k=>keys[k]===e.code);if(id)action(id);\n  });\n  // Shadow retargeting keeps game shortcuts out of panel inputs.\n  for(const type of ['keydown','keyup','mousedown','mouseup','wheel']) root.addEventListener(type,e=>e.stopPropagation());\n  let ticks=0;\n  const timer=setInterval(()=>{\n    const entry=selected();$('server').value=entry?entry.mode_name+' \u00b7 '+entry.host:'No supported server';\n    if(state.bots.some(b=>b.worker||b.status==='Queued') && (!entry||entry.host!==state.host))stop('Server changed \u2014 reconnect bots.');\n    ticks++;\n    state.bots.forEach(b=>{if(!b.worker||!b.ready)return;if(ticks%10===0)b.worker.postMessage({type:'ping'});\n      if(!state.paused&&$('follow').checked&&state.target)b.worker.postMessage({type:'move',...state.target});});\n  },100);\n  window.addEventListener('pagehide',()=>{clearInterval(timer);stop();},{once:true});\n  window.ONYXBots={stop,observePacket(buffer){\n    if($('target').value==='hold'&&state.target)return;\n    const b=buffer instanceof ArrayBuffer?new Uint8Array(buffer):ArrayBuffer.isView(buffer)?new Uint8Array(buffer.buffer,buffer.byteOffset,buffer.byteLength):null;\n    if(!b||b[0]!==20||b[1]!==0||b.length!==11)return;\n    const v=new DataView(b.buffer,b.byteOffset,b.byteLength);state.target={x:v.getInt32(3,true),y:v.getInt32(7,true)};\n  }};\n  document.body.appendChild(host);render();\n})();\n";
    var bytes = Array.from(new Uint8Array(wasm));
    if (bytes.length < 8 || bytes[0] !== 0 || bytes[1] !== 97 || bytes[2] !== 115 || bytes[3] !== 109) throw new Error('Invalid WASM download');
    var bootstrap = 'window.__ONYX_BOT_WORKER_URL__=URL.createObjectURL(new Blob([' +
      JSON.stringify('self.__ONYX_BOT_WASM_BYTES__=new Uint8Array(' + JSON.stringify(bytes) + ')' + ';\n' + workerSource) +
      '],{type:"text/javascript"}));';
    await injectScript(bootstrap, 'onyx-bot-bootstrap.js');
    await injectScript(panelSource, 'onyx-bots.js');
    await injectScript("\n(function () {\n  var attempts = 0;\n  function install() {\n    if (!window.SC || typeof window.SC.send !== 'function') return false;\n    var original = window.SC.send;\n    if (String(original).indexOf('observePacket') !== -1 || original.__onyxBotObserver) return true;\n    function send(buffer, tab) {\n      var result = original.apply(this, arguments);\n      try { if (window.ONYXBots) window.ONYXBots.observePacket(buffer); } catch (_) {}\n      return result;\n    }\n    send.__onyxBotObserver = true; window.SC.send = send; return true;\n  }\n  if (!install()) {\n    var timer = setInterval(function () { if (install() || ++attempts > 100) clearInterval(timer); }, 100);\n    window.addEventListener('pagehide', function () { clearInterval(timer); }, {once:true});\n  }\n})();\n", 'onyx-bot-cursor-bridge.js');
  }

  async function mount(baseUrl) {
    if (window.__KATERONYX_MOUNTED__) return;
    window.__KATERONYX_MOUNTED__ = true;

    var cssGets = LOCAL_CSS.map(function (file) {
      return gmGet(baseUrl + file + '?v=' + encodeURIComponent(VERSION)).then(function (css) {
        return [file, css];
      });
    });

    var v = encodeURIComponent(VERSION);
    var html = await gmGet(baseUrl + CLIENT_FILE + '?v=' + v);
    var wasm = await gmGet(baseUrl + '899.wasm?v=' + v, 'arraybuffer');
    var wasm89 = await gmGet(baseUrl + '89.wasm?v=' + v, 'arraybuffer');
    var fontBuf = null;
    try { fontBuf = await gmGet(baseUrl + 'assets/ryuten/iconfont.woff?v=' + v, 'arraybuffer'); } catch (err) {
      console.warn('[ONYX] iconfont.woff skipped', err && err.message || err);
    }
    var libJs = await gmGet(baseUrl + 'assets/js/lib.js?v=' + v);
    var runtimeJs = await gmGet(baseUrl + 'assets/js/runtime.58908f3dbdb804a00215.js?v=' + v);
    var vendorsJs = await gmGet(baseUrl + 'assets/js/vendors.c173b9063bd6941f8bc0.js?v=' + v);
    var authJs = await gmGet(baseUrl + 'onyx-senpa-auth.js?v=' + v);
    var customJs = await gmGet(baseUrl + 'onyx-custom.js?v=' + v);
    var soundsJs = await gmGet(baseUrl + 'assets/js/ryuten-sounds.js?v=' + v);
    var deoJs = await gmGet(baseUrl + 'deo.onyx.beautified.js?v=' + v);
    var extrasJs = await gmGet(baseUrl + 'assets/js/ryuten-extras.js?v=' + v);
    var serversJs = await gmGet(baseUrl + 'onyx-servers.js?v=' + v);
    var adapterJs = await gmGet(baseUrl + 'onyx-ffa-adapter.js?v=' + v);
    var uiJs = await gmGet(baseUrl + 'onyx-ui.js?v=' + v);

    var cdnTexts = await Promise.all(CDN_SCRIPTS.map(function (item) {
      return gmGet(item[0]).then(function (text) {
        return [item[1], text];
      }).catch(function (err) {
        throw new Error('CDN script failed (' + item[1] + '): ' + (err && err.message || err));
      });
    }));

    var cssPairs = await Promise.all(cssGets);
    var fontBlob = fontBuf ? URL.createObjectURL(new Blob([fontBuf], { type: 'font/woff' })) : '';
    var cssMap = {};
    for (var i = 0; i < cssPairs.length; i++) {
      cssMap[cssPairs[i][0]] = rewriteCssUrls(cssPairs[i][1], baseUrl, fontBlob);
    }

    var parsed = new DOMParser().parseFromString(html, 'text/html');
    if (!parsed.head || !parsed.body) throw new Error('index.html is not a complete HTML document.');
    parsed.querySelectorAll('script').forEach(function (node) { node.remove(); });
    rewriteAssets(parsed, baseUrl);
    inlineLocalStyles(parsed, cssMap);

    window.stop();
    var newHead = document.importNode(parsed.head, true);
    var newBody = document.importNode(parsed.body, true);
    document.documentElement.lang = parsed.documentElement.lang || 'en';
    document.documentElement.replaceChildren(newHead, newBody);
    document.title = 'ONYX';
    document.documentElement.querySelectorAll('iframe,embed,object').forEach(function (node) { node.remove(); });
    console.log('[ONYX] SENPA_ADS_BLOCKED = true');

    var wasmBlob = URL.createObjectURL(new Blob([wasm], { type: 'application/wasm' }));
    var wasm89Blob = URL.createObjectURL(new Blob([wasm89], { type: 'application/wasm' }));
    await injectScript(
      'window.__JAXXV6_USERSCRIPT__=false;' +
      wasmHookSource(wasmBlob, wasm89Blob, fontBlob, baseUrl),
      'bootstrap.js'
    );

    for (var p = 0; p < cdnTexts.length; p++) {
      await injectScript(cdnTexts[p][1], cdnTexts[p][0]);
    }
    await injectScript(libJs, 'lib.js');
    await injectScript(authJs, 'onyx-senpa-auth.js');
    await injectScript(runtimeJs, 'runtime.js');
    await injectScript(vendorsJs, 'vendors.js');
    await injectScript(customJs, 'onyx-custom.js');
    await injectScript(soundsJs, 'ryuten-sounds.js');
    await injectScript(serversJs, 'onyx-servers.js');
    await injectScript(adapterJs, 'onyx-ffa-adapter.js');
    await injectScript(deoJs, 'deo.onyx.beautified.js');
    await injectScript(extrasJs, 'ryuten-extras.js');
    await injectScript(uiJs, 'onyx-ui.js');
    try {
      await mountBotPanel(wasm);
    } catch (error) {
      console.error('[ONYX BOTS] Panel load failed', error);
      var botError = document.createElement('div');
      botError.textContent = 'Bot panel failed to load. Reload or check Console.';
      botError.style.cssText = 'position:fixed;top:70px;right:16px;z-index:2147483647;background:#351515;color:white;padding:14px';
      document.body.appendChild(botError);
    }
    await injectScript(
      'console.log("[ONYX-ENGINE] deo/PIXI injected, wasmLoader=" + !!(window.wasmLoader||window.A));',
      'onyx-runtime-init.js'
    );
    try { sessionStorage.removeItem(MOUNT_KEY); } catch (_) {}
  }

  killSenpaRuntime();
  seizePage();
  var baseUrl = getBaseUrl();
  renderLoading();
  mount(baseUrl).catch(function (error) {
    renderError(error && error.message ? error.message : error);
  });
})();
