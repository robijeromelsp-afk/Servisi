/**
 * JSON API of the web app.
 *
 * Request:  POST, body (text/plain) = JSON { action, idToken, data, lang }   (lang: language of error messages, sl|en)
 * Response: JSON { ok: true, data } or { ok: false, error: { code, message } }
 * Apps Script cannot set HTTP status codes, so errors are reported in the body.
 */

/**
 * Built at call time on purpose: Apps Script evaluates files one after another, so a
 * top-level reference to a function from a later file would be undefined.
 */
function actions_() {
  return {
  // action: [handler, minimum role, writes?]
  bootstrap: [apiBootstrap_, 'User', false],
  history: [apiHistory_, 'User', false],
  saveObject: [apiSaveObject_, 'User', true],
  archiveObject: [apiArchiveObject_, 'User', true],
  restoreObject: [apiRestoreObject_, 'User', true],
  saveObligation: [apiSaveObligation_, 'User', true],
  archiveObligation: [apiArchiveObligation_, 'User', true],
  restoreObligation: [apiRestoreObligation_, 'User', true],
  markDone: [apiMarkDone_, 'User', true],
  voidCompletion: [apiVoidCompletion_, 'User', true],
  snooze: [apiSnooze_, 'User', true],
  requestQuote: [apiRequestQuote_, 'User', true],
  cancelSnooze: [apiCancelSnooze_, 'User', true],
  saveCatalog: [apiSaveCatalog_, 'User', true],
  archiveCatalog: [apiArchiveCatalog_, 'User', true],
  restoreCatalog: [apiRestoreCatalog_, 'User', true],
  saveUser: [apiSaveUser_, 'Admin', true],
  saveSettings: [apiSaveSettings_, 'Admin', true],
  saveStorageClient: [apiSaveStorageClient_, 'Admin', true],
  archiveStorageClient: [apiArchiveStorageClient_, 'Admin', true],
  status: [apiStatus_, 'Admin', false],
  runDailyJob: [apiRunDailyJob_, 'Admin', true],
  installDailyTrigger: [apiInstallDailyTrigger_, 'Admin', true],
  sendTestEmail: [apiSendTestEmail_, 'Admin', true],
  exportData: [apiExport_, 'Admin', false],
  importData: [apiImport_, 'Admin', true]
  };
}

function doGet() {
  // Health check only; never returns data.
  return json_({ ok: true, data: { app: 'servisi', version: APP_VERSION, setUp: !!prop_('SPREADSHEET_ID') } });
}

/** Requests slower than this (ms) are written to RequestLog, as are all failures except sign-in. */
var SLOW_REQUEST_MS = 4000;
var REQ_T0_ = 0;
var REQ_PHASES_ = [];

/** Records the time since the start of the request, for RequestLog. */
function mark_(name) {
  REQ_PHASES_.push(name + '=' + (Date.now() - REQ_T0_));
}

function doPost(e) {
  var out;
  var lang = 'en';
  var action = '';
  REQ_T0_ = Date.now();
  REQ_PHASES_ = [];
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    lang = req.lang === 'sl' ? 'sl' : 'en';
    action = String(req.action || '');
    out = { ok: true, data: handle_(req) };
  } catch (err) {
    out = errorOut_(err, lang);
  }
  logRequest_(action, out);
  return json_(out);
}

function logRequest_(action, out) {
  try {
    var ms = Date.now() - REQ_T0_;
    var code = out.ok ? '' : out.error.code;
    if ((out.ok && ms < SLOW_REQUEST_MS) || code === 'AUTH' || !prop_('SPREADSHEET_ID')) return;
    db_().table('RequestLog').insert('', {
      action: action, ms: String(ms), ok: String(out.ok), code: code,
      message: out.ok ? '' : String(out.error.message).slice(0, 300),
      phases: REQ_PHASES_.join(' '), app_version: APP_VERSION
    }, 'request');
  } catch (e) {
    console.error('RequestLog: ' + e);
  }
}

function errorOut_(err, lang) {
  if (!err.appCode) console.error(err && err.stack ? err.stack : err);
  return {
    ok: false,
    error: {
      code: err.appCode || 'ERROR',
      message: translateError_(err.appCode ? err.message : 'Unexpected server error: ' + (err && err.message), lang)
    }
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(req) {
  resetDbCache_();
  var action = String(req.action || '');
  var data = req.data || {};
  if (action === 'whoami') return apiWhoami_(req.idToken);
  if (action === 'setup') return withLock_(function () { return apiSetup_(req.idToken, data); });
  if (action === 'upload') return apiUpload_(req.idToken, data);

  var def = actions_()[action];
  if (!def) throw appError_('BAD_REQUEST', 'Unknown action: ' + action);
  var auth = verifyIdToken_(req.idToken, false);
  mark_('auth');
  if (!prop_('SPREADSHEET_ID')) throw appError_('NOT_SET_UP', 'The application has not been set up yet.');
  var user = findUser_(auth.email);
  if (!user) throw appError_('FORBIDDEN', 'Your account is not on the access list.');
  if (def[1] === 'Admin' && user.role !== 'Admin') throw appError_('FORBIDDEN', 'Only an administrator can do this.');
  var tz = orgTimezone_(user.org_id);
  var ctx = { user: user, email: user.email, orgId: user.org_id, tz: tz, today: today_(tz) };
  mark_('user');
  var result = def[2] ? withLock_(function () { mark_('lock'); resetDbCache_(); return def[0](ctx, data); }) : def[0](ctx, data);
  mark_('done');
  return result;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw appError_('BUSY', 'The server is busy. Try again in a moment.');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Tells the page whether this deployment knows the signed-in user. */
function apiWhoami_(idToken) {
  var setUp = !!prop_('SPREADSHEET_ID');
  var auth = verifyIdToken_(idToken, !setUp);
  if (!setUp) {
    return { setUp: false, canSetUp: auth.email === ownerEmail_(), email: auth.email };
  }
  var user = findUser_(auth.email);
  if (!user) return { setUp: true, known: false, email: auth.email };
  var org = orgOf_(user.org_id);
  return {
    setUp: true, known: true, email: auth.email,
    org: { id: org.id, name: org.name },
    user: { id: user.id, display_name: user.display_name, role: user.role }
  };
}

/**
 * First-time setup. Only the Google account the deployment runs under may do it, and only
 * once. Creates (or adopts) the spreadsheet, the organisation, the first administrator,
 * default settings, the suggested catalog and the daily trigger.
 */
function apiSetup_(idToken, data) {
  if (prop_('SPREADSHEET_ID')) throw appError_('FORBIDDEN', 'The application is already set up.');
  var auth = verifyIdToken_(idToken, true);
  var owner = ownerEmail_();
  if (auth.email !== owner) throw appError_('FORBIDDEN', 'Only the owner of this deployment can set it up.');
  var orgName = String(data.orgName || '').trim();
  if (!orgName) throw appError_('INVALID', 'Enter the organisation name.');

  var ss;
  var sheetRef = String(data.spreadsheet || '').trim();
  if (sheetRef) {
    var m = /\/d\/([a-zA-Z0-9_-]{20,})/.exec(sheetRef);
    var id = m ? m[1] : sheetRef;
    try {
      ss = SpreadsheetApp.openById(id);
    } catch (e) {
      throw appError_('INVALID', 'The spreadsheet cannot be opened with this account. Check the link and sharing (editor).');
    }
  } else {
    ss = SpreadsheetApp.create('Servisi - ' + orgName);
  }
  var db = new Db_(ss);
  db.ensureSchema();
  if (db.table('Users').list(null, { includeArchived: true }).length) {
    throw appError_('FORBIDDEN', 'This spreadsheet already contains users. It cannot be set up again.');
  }
  setProp_('SPREADSHEET_ID', ss.getId());
  setProp_('OAUTH_CLIENT_ID', auth.aud);
  DB_CACHE_ = db;

  var tz = String(data.timezone || Session.getScriptTimeZone());
  // An organisation record carries its own id as org_id.
  var orgId = Utilities.getUuid();
  var org = db.table('Organizations').insert(orgId, { name: orgName, timezone: tz, locale: 'en' }, owner, { id: orgId });

  db.table('Users').insert(org.id, {
    email: owner, display_name: String(data.displayName || owner), role: 'Admin', active: 'true'
  }, owner);
  var settings = {
    monthly_day: '1', run_hour: '6', weekly_overdue_reminder: 'true',
    app_url: String(data.appUrl || ''), storage_url: String(data.storageUrl || ''),
    storage_enabled: data.storageUrl ? 'false' : 'true', mail_sender_name: 'Servisi',
    language: LANGUAGES.indexOf(data.language) >= 0 ? data.language : 'sl'
  };
  Object.keys(settings).forEach(function (k) { kvSet_('Settings', org.id, k, settings[k], owner); });
  seedCatalog_(org.id, owner);
  installDailyTrigger_(6);
  return { setUp: true, orgId: org.id, spreadsheetUrl: ss.getUrl() };
}
