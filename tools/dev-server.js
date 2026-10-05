#!/usr/bin/env node
'use strict';
/**
 * Local development server: serves the built frontend and runs the real backend code on
 * the in-memory Apps Script stand-in (tests/gas-mock.js). Sign-in is replaced by an e-mail
 * field (fake tokens that only this stand-in accepts). Nothing leaves this machine.
 *
 *   npm run build && node tools/dev-server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('../tests/gas-mock.js');

const PORT = parseInt(process.argv[2] || process.env.PORT || '8787', 10);
const FE = path.join(__dirname, '..', 'dist', 'frontend');
const OWNER = process.env.DEV_OWNER || 'owner@example.com';
const CLIENT = 'dev-client';

const backend = createBackend({ owner: OWNER, clientId: CLIENT, now: new Date() });
setInterval(() => backend.setNow(new Date().toISOString()), 1000).unref();

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/api')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const out = backend.ctx.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(out.getContent());
    });
    return;
  }
  if (req.url.startsWith('/__dev/')) {
    // Test hooks: run the daily job, read sent e-mails.
    if (req.url === '/__dev/daily') { backend.runDaily(); res.end('ok'); return; }
    if (req.url === '/__dev/mails') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(backend.state.mails)); return; }
  }
  const url = new URL(req.url, 'http://x');
  let file = path.join(FE, decodeURIComponent(url.pathname));
  if (!file.startsWith(FE)) { res.writeHead(403); res.end(); return; }
  if (url.pathname === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end('window.SERVISI_CONFIG = ' + JSON.stringify({ backends: [`http://localhost:${PORT}/api`], googleClientId: CLIENT, devLogin: true, version: 'dev' }) + ';');
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => console.log(`Servisi dev server on http://localhost:${PORT} (owner ${OWNER})`));
