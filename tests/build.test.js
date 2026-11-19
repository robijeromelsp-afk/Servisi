'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

test('build: every frontend module import carries the version (no stale cached modules)', () => {
  const root = path.join(__dirname, '..');
  execFileSync(process.execPath, [path.join(root, 'tools', 'build.js')], { cwd: root, stdio: 'pipe' });
  const fe = path.join(root, 'dist', 'frontend');
  const version = JSON.parse(fs.readFileSync(path.join(fe, 'config.js'), 'utf8').replace(/^window\.SERVISI_CONFIG = |;\s*$/g, '')).version;
  for (const f of fs.readdirSync(fe).filter((n) => n.endsWith('.js'))) {
    const imports = fs.readFileSync(path.join(fe, f), 'utf8').match(/from\s+'\.\/[^']+'/g) || [];
    for (const imp of imports) assert.ok(imp.endsWith(`?v=${version}'`), `${f}: ${imp}`);
  }
  assert.match(fs.readFileSync(path.join(fe, '_headers'), 'utf8'), /Cache-Control: no-cache/);
});
