/**
 * Sheet-backed tables.
 *
 * Every table is one sheet. Row 1 holds column names; columns are always looked up by
 * name, never by position. Every cell is written as plain text ('@' number format), so the
 * spreadsheet never turns dates or IDs into numbers or dates. Records are plain objects
 * whose values are strings.
 *
 * Records are never deleted: archive() sets archived_at, restore() clears it.
 * Every insert/update/archive/restore is written to AuditLog (before/after).
 */

var COMMON_COLUMNS = ['id', 'org_id', 'created_at', 'created_by', 'updated_at', 'updated_by',
  'archived_at', 'archived_by', 'archive_reason', 'rev'];

var SCHEMA = {
  Organizations: ['name', 'timezone', 'locale'],
  Settings: ['key', 'value'],
  Users: ['email', 'display_name', 'role', 'active'],
  ObjectKinds: ['name', 'sort'],
  ObligationGroups: ['name', 'sort'],
  ObligationTypes: ['group_id', 'name', 'description', 'is_suggestion', 'sort'],
  Contractors: ['name', 'contact_person', 'phone', 'email', 'note'],
  Objects: ['code', 'name', 'address', 'kind_id', 'responsible_user_id', 'site_contact', 'note'],
  Obligations: ['object_id', 'type_id', 'contractor_id', 'note',
    'rule_type', 'rule_weekday', 'rule_interval', 'rule_day', 'rule_months', 'rule_month',
    'start_date', 'count_from', 'last_done_before_app', 'warn_days_before', 'extra_recipients',
    'next_due', 'status', 'archived_with_object'],
  Completions: ['obligation_id', 'due_date', 'done_date', 'done_by', 'note',
    'void_at', 'void_by', 'void_reason'],
  Attachments: ['completion_id', 'obligation_id', 'drive_file_id', 'url', 'file_name', 'mime',
    'size_bytes', 'original_size_bytes', 'kind'],
  Snoozes: ['obligation_id', 'remind_on', 'note', 'sent_at', 'cancelled_at', 'cancelled_by'],
  StorageClients: ['email', 'org_label'],
  MailLog: ['kind', 'period', 'recipient', 'ref_id', 'items', 'sent_at', 'ok', 'error'],
  AuditLog: ['entity', 'entity_id', 'action', 'by', 'at', 'before_json', 'after_json'],
  Status: ['key', 'value']
};

/** Tables that are not audited themselves (they are logs). */
var UNAUDITED = { AuditLog: true, MailLog: true, Status: true };

var DB_CACHE_ = null;

function db_() {
  if (!DB_CACHE_) {
    var id = prop_('SPREADSHEET_ID');
    if (!id) throw appError_('NOT_SET_UP', 'The application has not been set up yet.');
    DB_CACHE_ = new Db_(SpreadsheetApp.openById(id));
  }
  return DB_CACHE_;
}

function resetDbCache_() {
  DB_CACHE_ = null;
}

function Db_(spreadsheet) {
  this.ss = spreadsheet;
  this.tables = {};
}

Db_.prototype.table = function (name) {
  if (!SCHEMA[name]) throw new Error('Unknown table ' + name);
  if (!this.tables[name]) this.tables[name] = new Table_(this, name);
  return this.tables[name];
};

/** Creates missing sheets and missing columns. Never removes or reorders anything. */
Db_.prototype.ensureSchema = function () {
  var self = this;
  Object.keys(SCHEMA).forEach(function (name) {
    var wanted = COMMON_COLUMNS.concat(SCHEMA[name]);
    var sheet = self.ss.getSheetByName(name) || self.ss.insertSheet(name);
    var lastCol = sheet.getLastColumn();
    var have = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    var missing = wanted.filter(function (c) { return have.indexOf(c) < 0; });
    if (missing.length) {
      sheet.getRange(1, have.length + 1, 1, missing.length).setNumberFormat('@').setValues([missing]);
    }
    sheet.setFrozenRows(1);
  });
  this.tables = {};
};

function Table_(db, name) {
  this.db = db;
  this.name = name;
  this.sheet = db.ss.getSheetByName(name);
  if (!this.sheet) throw new Error('Missing sheet ' + name + '. Run setup.');
  var values = this.sheet.getDataRange().getValues();
  this.headers = (values[0] || []).map(String);
  this.columns = COMMON_COLUMNS.concat(SCHEMA[name]);
  var self = this;
  this.columns.forEach(function (c) {
    if (self.headers.indexOf(c) < 0) throw new Error('Sheet ' + name + ' is missing column ' + c + '. Run setup.');
  });
  this.rows = [];
  this.rowIndex = {};
  for (var i = 1; i < values.length; i++) {
    var rec = {};
    var empty = true;
    for (var j = 0; j < this.headers.length; j++) {
      var v = cellToString_(values[i][j]);
      if (v !== '') empty = false;
      rec[this.headers[j]] = v;
    }
    if (empty || !rec.id) continue;
    this.rows.push(rec);
    this.rowIndex[rec.id] = i + 1;
  }
  this.nextRow = values.length + 1;
}

/** Converts what the sheet returns to a string. Dates typed by hand become YYYY-MM-DD. */
function cellToString_(v) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    var tz = Session.getScriptTimeZone();
    var hms = Utilities.formatDate(v, tz, 'HH:mm:ss');
    return hms === '00:00:00' ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v.toISOString();
  }
  return String(v);
}

function copy_(rec) {
  var out = {};
  Object.keys(rec).forEach(function (k) { out[k] = rec[k]; });
  return out;
}

/** All records of an organisation; archived ones only when asked. */
Table_.prototype.list = function (orgId, opts) {
  opts = opts || {};
  return this.rows.filter(function (r) {
    return (orgId === null || r.org_id === orgId) && (opts.includeArchived || !r.archived_at);
  }).map(copy_);
};

Table_.prototype.get = function (id, orgId) {
  if (!id || !this.rowIndex[id]) return null;
  for (var i = 0; i < this.rows.length; i++) {
    if (this.rows[i].id === id) {
      if (orgId !== null && orgId !== undefined && this.rows[i].org_id !== orgId) return null;
      return copy_(this.rows[i]);
    }
  }
  return null;
};

Table_.prototype.require = function (id, orgId, what) {
  var r = this.get(id, orgId);
  if (!r) throw appError_('NOT_FOUND', (what || 'Record') + ' not found.');
  return r;
};

Table_.prototype.writeRow_ = function (rowNumber, rec) {
  var arr = this.headers.map(function (h) {
    var v = rec[h];
    return v === null || v === undefined ? '' : String(v);
  });
  this.sheet.getRange(rowNumber, 1, 1, arr.length).setNumberFormat('@').setValues([arr]);
};

Table_.prototype.clean_ = function (data) {
  var out = {};
  var allowed = SCHEMA[this.name];
  Object.keys(data || {}).forEach(function (k) {
    if (allowed.indexOf(k) >= 0) {
      var v = data[k];
      out[k] = v === null || v === undefined ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  return out;
};

Table_.prototype.insert = function (orgId, data, actor, opts) {
  opts = opts || {};
  var ts = nowIso_();
  var rec = this.clean_(data);
  rec.id = opts.id || Utilities.getUuid();
  rec.org_id = orgId;
  rec.created_at = opts.created_at || ts;
  rec.created_by = opts.created_by || actor;
  rec.updated_at = opts.updated_at || ts;
  rec.updated_by = opts.updated_by || actor;
  rec.archived_at = opts.archived_at || '';
  rec.archived_by = opts.archived_by || '';
  rec.archive_reason = opts.archive_reason || '';
  rec.rev = opts.rev || '1';
  if (this.rowIndex[rec.id]) throw new Error('Duplicate id ' + rec.id + ' in ' + this.name);
  var row = this.nextRow++;
  this.writeRow_(row, rec);
  this.rows.push(rec);
  this.rowIndex[rec.id] = row;
  this.audit_('insert', rec.id, null, rec, actor, orgId);
  return copy_(rec);
};

/**
 * Updates fields. expectedRev (if given) must match, otherwise someone else changed
 * the record in the meantime and the update is refused.
 */
Table_.prototype.update = function (id, orgId, data, actor, expectedRev, action) {
  var row = this.rowIndex[id];
  var current = this.get(id, orgId);
  if (!row || !current) throw appError_('NOT_FOUND', 'Record not found.');
  if (expectedRev !== undefined && expectedRev !== null && expectedRev !== '' && String(expectedRev) !== current.rev) {
    throw appError_('CONFLICT', 'This record was changed by someone else in the meantime. Reload and try again.');
  }
  var next = copy_(current);
  var changes = this.clean_(data);
  var changed = false;
  Object.keys(changes).forEach(function (k) {
    if (next[k] !== changes[k]) { next[k] = changes[k]; changed = true; }
  });
  if (action === 'archive' || action === 'restore') {
    ['archived_at', 'archived_by', 'archive_reason'].forEach(function (k) {
      if (data[k] !== undefined && next[k] !== data[k]) { next[k] = data[k]; changed = true; }
    });
  }
  if (!changed) return current;
  next.updated_at = nowIso_();
  next.updated_by = actor;
  next.rev = String((parseInt(current.rev, 10) || 0) + 1);
  this.writeRow_(row, next);
  for (var i = 0; i < this.rows.length; i++) if (this.rows[i].id === id) this.rows[i] = next;
  this.audit_(action || 'update', id, current, next, actor, orgId);
  return copy_(next);
};

Table_.prototype.archive = function (id, orgId, actor, reason, expectedRev) {
  var current = this.require(id, orgId);
  if (current.archived_at) return current;
  return this.update(id, orgId, { archived_at: nowIso_(), archived_by: actor, archive_reason: reason || '' },
    actor, expectedRev, 'archive');
};

Table_.prototype.restore = function (id, orgId, actor, expectedRev) {
  var current = this.require(id, orgId);
  if (!current.archived_at) return current;
  return this.update(id, orgId, { archived_at: '', archived_by: '', archive_reason: '' }, actor, expectedRev, 'restore');
};

Table_.prototype.audit_ = function (action, id, before, after, actor, orgId) {
  if (UNAUDITED[this.name]) return;
  this.db.table('AuditLog').insert(orgId, {
    entity: this.name,
    entity_id: id,
    action: action,
    by: actor,
    at: nowIso_(),
    before_json: before ? JSON.stringify(before) : '',
    after_json: after ? JSON.stringify(after) : ''
  }, actor);
};

/** Key/value tables (Settings, Status). */
function kvGet_(tableName, orgId, key) {
  var rows = db_().table(tableName).list(orgId).filter(function (r) { return r.key === key; });
  return rows.length ? rows[0].value : '';
}

function kvAll_(tableName, orgId) {
  var out = {};
  db_().table(tableName).list(orgId).forEach(function (r) { out[r.key] = r.value; });
  return out;
}

function kvSet_(tableName, orgId, key, value, actor) {
  var t = db_().table(tableName);
  var rows = t.list(orgId).filter(function (r) { return r.key === key; });
  if (rows.length) return t.update(rows[0].id, orgId, { value: value }, actor);
  return t.insert(orgId, { key: key, value: value }, actor);
}
