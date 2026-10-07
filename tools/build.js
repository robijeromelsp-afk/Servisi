#!/usr/bin/env node
'use strict';
/**
 * Builds:
 *   dist/backend   Apps Script project (backend/*.js + shared/schedule.js + appsscript.json) for clasp
 *   dist/frontend  static site for Cloudflare Pages (frontend/* + shared/schedule.js + config.js)
 *
 * config.js is generated from environment variables (set in Cloudflare Pages), never committed:
 *   BACKENDS           comma separated list of Apps Script web app URLs (…/exec)
 *   GOOGLE_CLIENT_ID   OAuth client ID for Google sign-in
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

function version() {
  let sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (!sha) {
    try { sha = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { sha = 'local'; }
  }
  return new Date().toISOString().slice(0, 10) + '-' + sha.slice(0, 7);
}

function copyDir(src, dst, transform) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, transform);
    else if (transform && /\.(js|html|json|css)$/.test(name)) fs.writeFileSync(d, transform(fs.readFileSync(s, 'utf8'), name));
    else fs.copyFileSync(s, d);
  }
}

function main() {
  const v = version();
  const stamp = (text) => text.split('__APP_VERSION__').join(v);
  fs.rmSync(DIST, { recursive: true, force: true });

  // Backend. Schedule must load before the files that use it at call time; Apps Script
  // orders files by the push order, which clasp takes from the file names.
  const be = path.join(DIST, 'backend');
  copyDir(path.join(ROOT, 'backend'), be, stamp);
  fs.copyFileSync(path.join(ROOT, 'shared', 'schedule.js'), path.join(be, '00_schedule.js'));

  // Frontend.
  const fe = path.join(DIST, 'frontend');
  // Every module import carries the version, so a phone never mixes a new app.js with an old
  // cached api.js (happened on 7. 10. 2026: "api.cachedData is not a function").
  const stampModule = (text) => stamp(text).replace(/(from\s+'\.\/[\w-]+\.js)'/g, `$1?v=${v}'`);
  copyDir(path.join(ROOT, 'frontend'), fe, (text, file) => (file && file.endsWith('.js') ? stampModule(text) : stamp(text)));
  // Cloudflare Pages: always revalidate the page and scripts.
  fs.writeFileSync(path.join(fe, '_headers'), '/*\n  Cache-Control: no-cache\n');
  fs.copyFileSync(path.join(ROOT, 'shared', 'schedule.js'), path.join(fe, 'schedule.js'));
  const backends = (process.env.BACKENDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const config = {
    backends,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    version: v
  };
  fs.writeFileSync(path.join(fe, 'config.js'), 'window.SERVISI_CONFIG = ' + JSON.stringify(config, null, 2) + ';\n');
  if (!backends.length || !config.googleClientId) {
    console.warn('WARNING: BACKENDS or GOOGLE_CLIENT_ID is not set; the built site cannot sign in.');
  }
  console.log('Built version ' + v + ' into dist/');
}

main();
