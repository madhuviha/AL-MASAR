import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('super-admin/frontend/dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg'};
http.createServer((req,res)=>{
 let rel=decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\/admin\/?/,'');
 if(!rel||!path.extname(rel))rel='index.html';
 const file=path.resolve(root,rel);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);res.end('not found');return}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
 fs.createReadStream(file).pipe(res);
}).listen(8123,'127.0.0.1',()=>console.log('ready'));
