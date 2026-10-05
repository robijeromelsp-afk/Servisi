/**
 * Export of all data of an organisation into one ZIP file, and import of such a file
 * into an organisation that has no objects or obligations yet.
 *
 * ZIP content:
 *   data.json          every table of the organisation, archived records and logs included
 *   csv/<table>.csv    the same as CSV (UTF-8, comma separated)
 *   attachments.csv    every attachment with Drive id and link (files stay in Drive)
 *   README.txt         what the files are
 */

var EXPORT_SCHEMA_VERSION = 1;
var IMPORT_TABLES = ['ObjectKinds', 'ObligationGroups', 'ObligationTypes', 'Contractors', 'Objects',
  'Obligations', 'Completions', 'Attachments', 'Snoozes', 'Settings'];

function csvCell_(v) {
  var s = String(v === null || v === undefined ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCsv_(columns, rows) {
  return [columns.map(csvCell_).join(',')].concat(rows.map(function (r) {
    return columns.map(function (c) { return csvCell_(r[c]); }).join(',');
  })).join('\r\n');
}

function apiExport_(ctx) {
  var org = orgOf_(ctx.orgId);
  var data = { schema_version: EXPORT_SCHEMA_VERSION, app_version: APP_VERSION, exported_at: nowIso_(),
    exported_by: ctx.email, organisation: org, tables: {} };
  var blobs = [];
  Object.keys(SCHEMA).forEach(function (name) {
    if (name === 'Organizations') return;
    var rows = t_(name).list(ctx.orgId, { includeArchived: true });
    data.tables[name] = rows;
    blobs.push(Utilities.newBlob('﻿' + toCsv_(COMMON_COLUMNS.concat(SCHEMA[name]), rows), 'text/csv', 'csv/' + name + '.csv'));
  });
  var att = data.tables.Attachments;
  blobs.push(Utilities.newBlob('﻿' + toCsv_(['id', 'obligation_id', 'completion_id', 'kind', 'file_name', 'mime',
    'size_bytes', 'drive_file_id', 'url'], att), 'text/csv', 'attachments.csv'));
  blobs.push(Utilities.newBlob(JSON.stringify(data, null, 1), 'application/json', 'data.json'));
  blobs.push(Utilities.newBlob([
    'Servisi export of "' + org.name + '"',
    'Exported ' + data.exported_at + ' by ' + ctx.email + ', schema version ' + EXPORT_SCHEMA_VERSION + '.',
    '',
    'data.json        all records of the organisation (archived records and logs included).',
    '                 It can be imported into an empty Servisi deployment (Settings > Import).',
    'csv/*.csv        the same tables as CSV.',
    'attachments.csv  attachments; the files themselves stay in Google Drive (see url).',
    '',
    'Every record has a permanent id (UUID), created_at/by, updated_at/by and archived_at/by.',
    'Dates without time are YYYY-MM-DD; timestamps are ISO 8601 in UTC.'
  ].join('\r\n'), 'text/plain', 'README.txt'));
  var stamp = ctx.today;
  var zip = Utilities.zip(blobs, 'servisi-export-' + stamp + '.zip');
  return { fileName: zip.getName(), base64: Utilities.base64Encode(zip.getBytes()), counts: countRows_(data.tables) };
}

function countRows_(tables) {
  var out = {};
  Object.keys(tables).forEach(function (k) { out[k] = tables[k].length; });
  return out;
}

/**
 * Imports data.json (as parsed object) into this organisation. Allowed only while the
 * organisation has no objects and no obligations. Ids, timestamps and authors are kept;
 * the records are moved to this organisation. Users are not imported (the access list
 * of the new deployment is set up separately); user references are kept as they are and
 * can be re-assigned.
 */
function apiImport_(ctx, d) {
  var data = d.data;
  if (!data || !data.tables || data.schema_version !== EXPORT_SCHEMA_VERSION) {
    throw appError_('INVALID', 'This is not a Servisi export (data.json) of a supported version.');
  }
  if (t_('Objects').list(ctx.orgId, { includeArchived: true }).length ||
      t_('Obligations').list(ctx.orgId, { includeArchived: true }).length) {
    throw appError_('INVALID', 'Import is only possible into an organisation without objects and obligations.');
  }
  // Suggested catalog entries created by setup are archived, so only imported ones stay active.
  ['ObjectKinds', 'ObligationGroups', 'ObligationTypes'].forEach(function (name) {
    t_(name).list(ctx.orgId).forEach(function (r) { t_(name).archive(r.id, ctx.orgId, ctx.email, 'Replaced by import'); });
  });
  var counts = {};
  IMPORT_TABLES.forEach(function (name) {
    var rows = data.tables[name] || [];
    var table = t_(name);
    counts[name] = 0;
    rows.forEach(function (r) {
      if (name === 'Settings') {
        if (['monthly_day', 'run_hour', 'weekly_overdue_reminder', 'mail_sender_name'].indexOf(r.key) >= 0) {
          kvSet_('Settings', ctx.orgId, r.key, r.value, ctx.email);
          counts[name]++;
        }
        return;
      }
      if (table.get(r.id, null)) return; // already present
      var fields = {};
      SCHEMA[name].forEach(function (c) { fields[c] = r[c]; });
      table.insert(ctx.orgId, fields, ctx.email, {
        id: r.id, created_at: r.created_at, created_by: r.created_by, updated_at: r.updated_at,
        updated_by: r.updated_by, archived_at: r.archived_at, archived_by: r.archived_by,
        archive_reason: r.archive_reason, rev: r.rev
      });
      counts[name]++;
    });
  });
  recomputeAll_(ctx, ctx.email);
  return { imported: counts };
}
