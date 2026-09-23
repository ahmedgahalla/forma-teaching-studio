import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(fileURLToPath(new URL('../out/', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const host = process.env.FORMA_HOST || '127.0.0.1';
if (!existsSync(path.join(root, 'index.html'))) { console.error('Build the app first with npm run build.'); process.exit(1); }
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.stl': 'model/stl', '.glb': 'model/gltf-binary' };
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let route;
  try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (route === '/forma-health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"app":"forma-dental-studio","status":"ok"}'); return; }
  let target = path.resolve(root, `.${route}`);
  if ((target !== root && !target.startsWith(root + path.sep)) || route.includes('\\')) { res.writeHead(403); res.end(); return; }
  if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, 'index.html');
  if (!existsSync(target) || !statSync(target).isFile()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(target); stream.on('error', () => res.destroy()); stream.pipe(res);
});
server.on('error', error => { console.error(`Could not open port ${port}: ${error.message}. Close the other local server, or set PORT to another port.`); process.exit(1); });
server.listen(port, host, () => {
  const url = `http://${host}:${port}`;
  console.log(`Forma Dental Studio is ready at ${url}\nKeep this terminal open while using the app. Press Ctrl+C to stop.`);
  if (process.argv.includes('--open')) {
    if (process.platform === 'win32') spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true });
    else spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
  }
});
