'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),port=3020;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.cjs':'text/plain; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm','.json':'application/json; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif'};
http.createServer((req,res)=>{try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1:'+port).pathname);if(pathname==='/')pathname='/onyx-local-install.html';if(pathname==='/Onyx-Senpa-Local.user.js')pathname='/kateronyx.user.js';
 const segments=pathname.split(/[\\/]/);if(segments.some(name=>name.startsWith('.')||/^(?:artifacts|\.test|node_modules|relay\.cookie\.json|relay\.config\.json)$/i.test(name))){res.writeHead(403);res.end('Forbidden');return;}
 const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(_){res.writeHead(400);res.end('Invalid request');}}).listen(port,'127.0.0.1',()=>console.log('Onyx local installer: http://127.0.0.1:'+port+'/'));
