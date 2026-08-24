#!/usr/bin/env node
/* VENUES §6-3: 実ブラウザでJA/EN・390/1280pxを描画する検査 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const root = path.join(process.cwd(), 'LP');
const mime = { '.html':'text/html;charset=utf-8', '.js':'text/javascript;charset=utf-8', '.css':'text/css;charset=utf-8', '.json':'application/json' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname === '/__check.html') return;
  const file = path.join(root, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const probe = `<script>window.addEventListener('load',()=>setTimeout(()=>{const t=document.body.innerText;document.body.setAttribute('data-venue-detail-check',JSON.stringify({info:t.includes('INFORMATION'),near:t.includes('NEARBY VENUES')||t.includes('近くの会場'),undef:t.includes('undefined')}));},2500));</script>`;
const source = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace('</body>', probe + '</body>');
server.on('request', (req, res) => {
  if (new URL(req.url, 'http://x').pathname === '/__check.html') { res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'}); return res.end(source('venues/bonobo.html')); }
});
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const failures = [];
for (const width of [390, 1280]) {
  for (const lang of ['ja', 'en']) {
    for (const id of ['bonobo', 'club-metro']) {
      const original = source(`${lang === 'en' ? 'en/' : ''}venues/${id}.html`);
      server.removeAllListeners('request');
      server.on('request', (req, res) => {
        if (new URL(req.url, 'http://x').pathname === '/__check.html') { res.writeHead(200, {'Content-Type':'text/html;charset=utf-8'}); return res.end(original); }
        const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(root, pathname.replace(/^\//, ''));
        if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'}); res.end(fs.readFileSync(file));
      });
      const child = spawn(chrome, ['--headless=new','--disable-gpu','--disable-service-worker','--no-sandbox','--no-first-run','--window-size='+width+',844','--virtual-time-budget=7000','--dump-dom',`${base}/__check.html`], {stdio:['ignore','pipe','ignore']});
      let html = ''; child.stdout.on('data', chunk => { html += chunk; });
      await new Promise(resolve => { const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} resolve(); }, 15000); child.on('close', () => { clearTimeout(timer); resolve(); }); });
      const match = html.match(/data-venue-detail-check="([^\"]*)"/);
      if (!match) { failures.push(`${lang}/${id} ${width}px: DOM取得失敗`); continue; }
      const result = JSON.parse(match[1].replace(/&quot;/g, '"'));
      if (!result.info || !result.near || result.undef) failures.push(`${lang}/${id} ${width}px: 詳細表示不正`);
    }
  }
}
server.close();
if (failures.length) { failures.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('  ✅ bar / club × JA / EN × 390px / 1280px を実ブラウザで描画');
