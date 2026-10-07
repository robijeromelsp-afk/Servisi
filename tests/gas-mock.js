'use strict';
/**
 * In-memory stand-in for the Apps Script services the backend uses, so the real backend
 * code can be run and tested in Node (and by the local dev server). It imitates the
 * behaviour that matters to us, including the one trap from KT4: a cell without the '@'
 * (plain text) format turns 'YYYY-MM-DD' strings into Date objects.
 *
 * This is NOT proof that the code works in Apps Script; that is checked on a test
 * deployment.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function backendFiles() {
  const dir = path.join(ROOT, 'backend');
  return [path.join(ROOT, 'shared', 'schedule.js')].concat(
    fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(dir, f)));
}

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.cells[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.nr || values[0].length !== this.nc) throw new Error('Range size mismatch');
    for (let i = 0; i < this.nr; i++) {
      const ri = this.r - 1 + i;
      this.sheet.cells[ri] = this.sheet.cells[ri] || [];
      this.sheet.formats[ri] = this.sheet.formats[ri] || [];
      for (let j = 0; j < this.nc; j++) {
        let v = values[i][j];
        const fmtText = this.sheet.formats[ri][this.c - 1 + j] === '@';
        if (!fmtText && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) v = new Date(v + 'T00:00:00');
        this.sheet.cells[ri][this.c - 1 + j] = v;
      }
    }
    return this;
  }
  setNumberFormat(f) {
    for (let i = 0; i < this.nr; i++) {
      const ri = this.r - 1 + i;
      this.sheet.formats[ri] = this.sheet.formats[ri] || [];
      for (let j = 0; j < this.nc; j++) this.sheet.formats[ri][this.c - 1 + j] = f;
    }
    return this;
  }
}

class Sheet {
  constructor(name) { this.name = name; this.cells = []; this.formats = []; }
  getName() { return this.name; }
  getLastRow() { return this.cells.length; }
  getLastColumn() { return this.cells.reduce((m, r) => Math.max(m, (r || []).length), 0); }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows() { return this; }
}

class Spreadsheet {
  constructor(id, name) { this.id = id; this.name = name; this.sheets = {}; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { this.sheets[n] = new Sheet(n); return this.sheets[n]; }
}

class Folder {
  constructor(drive, name) {
    this.drive = drive; this.id = 'folder-' + crypto.randomUUID(); this.name = name;
    this.folders = []; this.files = []; this.viewers = [];
    drive.items[this.id] = this;
  }
  getId() { return this.id; }
  getName() { return this.name; }
  createFolder(n) { const f = new Folder(this.drive, n); this.folders.push(f); return f; }
  getFoldersByName(n) {
    const list = this.folders.filter((f) => f.name === n);
    return { hasNext: () => list.length > 0, next: () => list.shift() };
  }
  createFile(blob) {
    const id = 'file-' + crypto.randomUUID();
    const file = {
      id, blob, description: '',
      getId: () => id, getUrl: () => 'https://drive.google.com/file/d/' + id + '/view',
      getSize: () => blob.getBytes().length, setDescription(d) { this.description = d; return this; }
    };
    this.files.push(file); this.drive.items[id] = file;
    return file;
  }
  getViewers() { return this.viewers.map((e) => ({ getEmail: () => e })); }
  getEditors() { return []; }
  addViewer(e) { this.viewers.push(e); return this; }
}

function makeBlob(data, mime, name) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(Array.isArray(data) ? data : String(data), Array.isArray(data) ? undefined : 'utf8');
  return {
    getBytes: () => Array.from(bytes), getDataAsString: () => bytes.toString('utf8'),
    getName: () => name, setName(n) { name = n; return this; }, getContentType: () => mime, _buf: bytes
  };
}

function formatDate(date, tz, fmt) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  if (fmt === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
  if (fmt === 'HH:mm:ss') return `${parts.hour}:${parts.minute}:${parts.second}`;
  throw new Error('Unsupported format ' + fmt);
}

/**
 * Creates a fresh backend instance.
 * opts.owner      e-mail of the account the deployment runs under
 * opts.clientId   OAuth client id the fake tokens are issued for
 * opts.now        Date of "now" (mutable via env.setNow)
 */
function createBackend(opts = {}) {
  const state = {
    owner: opts.owner || 'owner@example.com',
    clientId: opts.clientId || 'client-123.apps.googleusercontent.com',
    now: opts.now || new Date('2027-01-04T07:00:00Z'),
    props: {}, cache: {}, spreadsheets: {}, mails: [], triggers: [], fetches: 0,
    drive: { items: {} }, mailQuota: 100, failMailTo: null
  };
  state.drive.root = new Folder(state.drive, 'My Drive');

  const ctx = {
    console: { log() {}, error() {}, warn() {} },
    Date, JSON, Math, Number, String, Object, Array, Error, RegExp, Buffer,
    SpreadsheetApp: {
      openById(id) { if (!state.spreadsheets[id]) throw new Error('not found'); return state.spreadsheets[id]; },
      create(name) { const id = 'ss-' + crypto.randomUUID().replace(/-/g, ''); state.spreadsheets[id] = new Spreadsheet(id, name); return state.spreadsheets[id]; }
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in state.props ? state.props[k] : null),
      setProperty: (k, v) => { state.props[k] = String(v); },
      getProperties: () => ({ ...state.props })
    }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (k in state.cache ? state.cache[k] : null), put: (k, v) => { state.cache[k] = v; }, remove: (k) => { delete state.cache[k]; }
    }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    Session: {
      getScriptTimeZone: () => 'Europe/Ljubljana',
      getEffectiveUser: () => ({ getEmail: () => state.owner })
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate,
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(String(s)).digest()),
      base64EncodeWebSafe: (b) => Buffer.from(b).toString('base64url'),
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64DecodeWebSafe: (s) => Array.from(Buffer.from(String(s), 'base64url')),
      computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', String(k)).update(String(v)).digest()),
      base64Decode: (s) => { const b = Buffer.from(s, 'base64'); if (s && !b.length) throw new Error('bad'); return Array.from(b); },
      newBlob: (data, mime, name) => makeBlob(data, mime, name),
      zip: (blobs, name) => {
        const files = blobs.map((b) => ({ name: b.getName(), data: b._buf.toString('utf8') }));
        return makeBlob(Buffer.from(JSON.stringify(files)), 'application/zip', name);
      }
    },
    UrlFetchApp: {
      fetch(url) {
        state.fetches++;
        const m = /id_token=([^&]+)/.exec(url);
        const token = m ? decodeURIComponent(m[1]) : '';
        // Fake token format: fake:<email>:<aud>[:expired]
        const p = token.split(':');
        const ok = p[0] === 'fake' && p.length >= 3 && p[3] !== 'expired';
        const body = ok ? {
          iss: 'https://accounts.google.com', aud: p.slice(2, 3)[0], email: p[1], email_verified: 'true',
          exp: String(Math.floor(state.now.getTime() / 1000) + 3600)
        } : { error: 'invalid_token' };
        return { getResponseCode: () => (ok ? 200 : 400), getContentText: () => JSON.stringify(body) };
      }
    },
    MailApp: {
      sendEmail(msg) {
        if (state.failMailTo && msg.to === state.failMailTo) throw new Error('Invalid email');
        state.mails.push(msg); state.mailQuota--;
      },
      getRemainingDailyQuota: () => state.mailQuota
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; }, getContent() { return this.content; } })
    },
    ScriptApp: {
      getProjectTriggers: () => state.triggers.slice(),
      deleteTrigger: (t) => { state.triggers = state.triggers.filter((x) => x !== t); },
      newTrigger: (fn) => {
        const t = { fn, getHandlerFunction: () => fn };
        const b = { timeBased: () => b, everyDays: (n) => { t.days = n; return b; }, atHour: (h) => { t.hour = h; return b; },
          create: () => { state.triggers.push(t); return t; } };
        return b;
      }
    },
    DriveApp: {
      createFolder: (n) => state.drive.root.createFolder(n),
      getFolderById: (id) => { const f = state.drive.items[id]; if (!f) throw new Error('not found'); return f; }
    }
  };
  vm.createContext(ctx);
  for (const file of backendFiles()) {
    vm.runInContext(fs.readFileSync(file, 'utf8').split('__APP_VERSION__').join('dev'), ctx, { filename: file });
  }
  // Fixed clock for the code under test.
  vm.runInContext('now_ = function () { return new Date(__now__()); };', Object.assign(ctx, { __now__: () => state.now.getTime() }));

  function call(action, email, data, aud) {
    const idToken = email ? `fake:${email}:${aud || state.clientId}` : '';
    const res = ctx.doPost({ postData: { contents: JSON.stringify({ action, idToken, data }) } });
    return JSON.parse(res.getContent());
  }
  function ok(action, email, data) {
    const r = call(action, email, data);
    if (!r.ok) throw new Error(`${action} failed: ${r.error.code} ${r.error.message}`);
    return r.data;
  }
  return {
    ctx, state, call, ok,
    setNow: (iso) => { state.now = new Date(iso); },
    spreadsheet: () => state.spreadsheets[state.props.SPREADSHEET_ID],
    runDaily: () => { ctx.dailyJob(); }
  };
}

module.exports = { createBackend };
