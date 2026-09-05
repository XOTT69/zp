import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes } from 'node:crypto';
process.env.NODE_ENV = 'development';
process.env.AUTH_SECRET ||= randomBytes(32).toString('hex');
for (const role of ['OPERATOR','SUPERVISOR','LEVEL4','XD','VIDEO','IRON','ADMIN']) process.env[`${role}_ACCESS_CODE`] ||= 'local-preview';
const root = resolve(import.meta.dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      if (!/^\/api\/(?:[a-z-]+\/)*[a-z-]+$/.test(url.pathname)) { res.writeHead(404).end(); return; }
      const file = resolve(root, `.${url.pathname}.js`);
      const {default:handler} = await import(file);
      await handler(req,res); return;
    }
    if (!extname(url.pathname)) {
      const {default:handler} = await import('../api/page.js');
      await handler(req,res); return;
    }
    const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + '/') || /\/(?:api|\.git|node_modules|scripts|\.env)(?:\/|$)/.test(file.slice(root.length))) {res.writeHead(404).end();return;}
    if (!(await stat(file)).isFile()) {res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(500);res.end('Request failed'); }
}).listen(4174,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4174 — preview role code: local-preview'));
