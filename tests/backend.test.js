'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBackend } = require('./gas-mock.js');

const OWNER = 'owner@example.com';
const USER = 'user@example.com';

function setUp(opts, language = 'en') {
  const b = createBackend(opts);
  b.ok('setup', OWNER, { orgName: 'Test Org', displayName: 'Owner', appUrl: 'https://app.example.com', language });
  return b;
}

function firstType(boot) {
  return boot.obligationTypes.find((t) => !t.archived_at);
}

function makeObject(b, email = OWNER, extra = {}) {
  return b.ok('saveObject', email, { code: 'K1', name: 'Boiler room 1', address: 'Street 1', ...extra });
}

function makeObligation(b, objectId, rule, email = OWNER) {
  const boot = b.ok('bootstrap', email);
  return b.ok('saveObligation', email, { object_id: objectId, type_id: firstType(boot).id, ...rule });
}

const YEARLY = { rule_type: 'leto', count_from: 'calendar', rule_day: 15, rule_month: 1, start_date: '2027-01-01' };

// ------------------------------------------------------------------ setup and access

test('setup: only the deployment owner, only once', () => {
  const b = createBackend();
  let r = b.call('setup', USER, { orgName: 'X' });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'FORBIDDEN');
  const who = b.ok('whoami', OWNER);
  assert.equal(who.setUp, false);
  assert.equal(who.canSetUp, true);
  b.ok('setup', OWNER, { orgName: 'Test Org' });
  r = b.call('setup', OWNER, { orgName: 'Again' });
  assert.equal(r.ok, false);
  assert.equal(b.state.props.OAUTH_CLIENT_ID, b.state.clientId);
  assert.equal(b.state.triggers.length, 1);
  assert.equal(b.state.triggers[0].hour, 6);
});

test('setup seeds a suggested catalog without any intervals', () => {
  const b = setUp();
  const boot = b.ok('bootstrap', OWNER);
  assert.equal(boot.obligationTypes.length, 19);
  assert.ok(boot.obligationTypes.every((t) => t.is_suggestion === 'true'));
  assert.equal(boot.obligations.length, 0);
  assert.equal(boot.me.role, 'Admin');
});

test('access list: unknown accounts and foreign client ids are refused', () => {
  const b = setUp();
  let r = b.call('bootstrap', USER);
  assert.equal(r.error.code, 'FORBIDDEN');
  r = b.call('bootstrap', OWNER, {}, 'other-client');
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'AUTH');
  r = b.call('bootstrap', '');
  assert.equal(r.error.code, 'AUTH');
  b.ok('saveUser', OWNER, { email: USER, display_name: 'User', role: 'User' });
  assert.equal(b.ok('bootstrap', USER).me.role, 'User');
  r = b.call('saveUser', USER, { email: 'x@example.com' });
  assert.equal(r.error.code, 'FORBIDDEN');
  const who = b.ok('whoami', 'nobody@example.com');
  assert.equal(who.known, false);
});

test('the last active administrator cannot be removed', () => {
  const b = setUp();
  const me = b.ok('bootstrap', OWNER).me;
  const r = b.call('saveUser', OWNER, { id: me.id, email: OWNER, role: 'User' });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /administrator/);
});

// ------------------------------------------------------------------ data rules

test('records get UUIDs, authorship and revision; dates stay text in the sheet', () => {
  const b = setUp();
  const obj = makeObject(b);
  assert.match(obj.id, /^[0-9a-f-]{36}$/);
  assert.equal(obj.created_by, OWNER);
  assert.equal(obj.rev, '1');
  const o = makeObligation(b, obj.id, YEARLY);
  assert.equal(o.next_due, '2027-01-15');
  const sheet = b.spreadsheet().getSheetByName('Obligations');
  const headers = sheet.cells[0];
  const row = sheet.cells[1];
  assert.equal(typeof row[headers.indexOf('next_due')], 'string');
  assert.equal(row[headers.indexOf('start_date')], '2027-01-01');
});

test('stale revision is refused (concurrent edit)', () => {
  const b = setUp();
  const obj = makeObject(b);
  b.ok('saveObject', OWNER, { id: obj.id, rev: obj.rev, code: 'K1', name: 'Renamed' });
  const r = b.call('saveObject', OWNER, { id: obj.id, rev: obj.rev, code: 'K1', name: 'Other' });
  assert.equal(r.error.code, 'CONFLICT');
});

test('every change is in the audit log with before and after', () => {
  const b = setUp();
  const obj = makeObject(b);
  b.ok('saveObject', OWNER, { id: obj.id, code: 'K1', name: 'Renamed' });
  const audit = b.ctx.db_().table('AuditLog').list(null).filter((a) => a.entity_id === obj.id);
  assert.deepEqual(audit.map((a) => a.action).join(','), 'insert,update');
  assert.equal(JSON.parse(audit[1].before_json).name, 'Boiler room 1');
  assert.equal(JSON.parse(audit[1].after_json).name, 'Renamed');
});

test('duplicate object code is refused', () => {
  const b = setUp();
  makeObject(b);
  const r = b.call('saveObject', OWNER, { code: 'k1', name: 'Other' });
  assert.equal(r.ok, false);
});

test('archiving an object archives its obligations; restore brings back exactly those', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o1 = makeObligation(b, obj.id, YEARLY);
  const o2 = makeObligation(b, obj.id, YEARLY);
  b.ok('archiveObligation', OWNER, { id: o2.id, reason: 'Not needed' });
  b.ok('archiveObject', OWNER, { id: obj.id, reason: 'Sold' });
  let boot = b.ok('bootstrap', OWNER);
  assert.ok(boot.obligations.every((o) => o.archived_at));
  b.ok('restoreObject', OWNER, { id: obj.id });
  boot = b.ok('bootstrap', OWNER);
  assert.equal(boot.obligations.find((o) => o.id === o1.id).archived_at, '');
  assert.notEqual(boot.obligations.find((o) => o.id === o2.id).archived_at, '');
  // nothing was deleted
  assert.equal(boot.obligations.length, 2);
});

test('incomplete obligation is stored with status Incomplete and no due date', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, { rule_type: 'leto', count_from: 'calendar' });
  assert.equal(o.status, 'Incomplete');
  assert.equal(o.next_due, '');
});

// ------------------------------------------------------------------ completions

test('mark done computes the next due, keeps history, void restores', () => {
  const b = setUp();
  b.setNow('2027-03-10T08:00:00Z');
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  const res = b.ok('markDone', OWNER, {
    obligation_id: o.id, done_date: '2027-03-09', note: 'Late',
    attachments: [{ drive_file_id: 'f1', url: 'https://drive.google.com/file/d/f1/view', kind: 'Report', mime: 'application/pdf' }]
  });
  assert.equal(res.completion.due_date, '2027-01-15');
  assert.equal(res.obligation.next_due, '2028-01-15');
  const h = b.ok('history', OWNER, { obligation_id: o.id });
  assert.equal(h.completions.length, 1);
  assert.equal(h.attachments.length, 1);
  assert.equal(h.computed.history[0].late, true);
  const v = b.ok('voidCompletion', OWNER, { id: res.completion.id, reason: 'Wrong obligation' });
  assert.equal(v.obligation.next_due, '2027-01-15');
  const h2 = b.ok('history', OWNER, { obligation_id: o.id });
  assert.equal(h2.completions.length, 1); // still there, voided
  assert.ok(h2.completions[0].void_at);
});

test('mark done refuses future dates, foreign links and stale due dates', () => {
  const b = setUp();
  b.setNow('2027-03-10T08:00:00Z');
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  assert.equal(b.call('markDone', OWNER, { obligation_id: o.id, done_date: '2027-03-11' }).ok, false);
  assert.equal(b.call('markDone', OWNER, { obligation_id: o.id, done_date: '2027-03-01',
    attachments: [{ drive_file_id: 'x', url: 'https://evil.example.com/x' }] }).ok, false);
  const r = b.call('markDone', OWNER, { obligation_id: o.id, done_date: '2027-03-01', expected_due: '2026-01-15' });
  assert.equal(r.error.code, 'CONFLICT');
});

// ------------------------------------------------------------------ daily job and e-mail

function mailsTo(b, to) {
  return b.state.mails.filter((m) => m.to === to);
}

test('monthly e-mail: sent once per month, grouped, catches up after a missed day', () => {
  const b = setUp();
  b.ok('saveUser', OWNER, { email: USER, display_name: 'User', role: 'User' });
  const boot = b.ok('bootstrap', OWNER);
  const user = boot.users.find((u) => u.email === USER);
  const objA = makeObject(b, OWNER, { responsible_user_id: user.id });
  const objB = b.ok('saveObject', OWNER, { code: 'S2', name: 'Building 2' });
  makeObligation(b, objA.id, YEARLY); // due 2027-01-15 -> this month
  makeObligation(b, objB.id, { ...YEARLY, rule_month: 2 }); // next month, object without responsible -> admins
  makeObligation(b, objB.id, { rule_type: 'leto', count_from: 'calendar' }); // incomplete
  b.state.mails = [];

  // Trigger did not run on the 1st; first run is on the 4th.
  b.setNow('2027-01-04T06:00:00Z');
  b.runDaily();
  const toUser = mailsTo(b, USER);
  const toOwner = mailsTo(b, OWNER);
  assert.equal(toUser.length, 1);
  assert.match(toUser[0].body, /Due this month \(1\)/);
  assert.match(toUser[0].body, /K1 - Boiler room 1/);
  assert.doesNotMatch(toUser[0].body, /S2/);
  assert.equal(toOwner.length, 1);
  assert.match(toOwner[0].body, /Due next month \(1\)/);
  assert.match(toOwner[0].body, /Incomplete setup/);
  assert.match(toOwner[0].htmlBody, /does not provide legal advice/);

  b.setNow('2027-01-05T06:00:00Z');
  b.runDaily();
  assert.equal(mailsTo(b, USER).length, 1, 'not sent twice in one month');

  b.setNow('2027-02-01T06:00:00Z');
  b.runDaily();
  // 1 Feb 2027 is a Monday: the monthly e-mail replaces the weekly overdue reminder that day.
  assert.equal(mailsTo(b, USER).length, 2);
  assert.match(mailsTo(b, USER)[1].body, /Overdue \(1\)/);
  b.setNow('2027-02-08T06:00:00Z');
  b.runDaily();
  assert.equal(mailsTo(b, USER).length, 3);
  assert.match(mailsTo(b, USER)[2].subject, /Overdue obligations \(1\)/);
});

test('monthly e-mail is sent even when empty; respects monthly_day', () => {
  const b = setUp();
  b.ok('saveSettings', OWNER, { values: { monthly_day: '3' } });
  b.state.mails = [];
  b.setNow('2027-03-02T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.length, 0);
  b.setNow('2027-03-03T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.length, 1);
  assert.match(b.state.mails[0].body, /Nothing is overdue/);
});

test('extra recipients: external address gets only its lines and no links', () => {
  const b = setUp();
  const obj = makeObject(b);
  makeObligation(b, obj.id, { ...YEARLY, extra_recipients: [{ email: 'Contractor@Example.com' }] });
  makeObligation(b, obj.id, YEARLY);
  b.setNow('2027-01-04T06:00:00Z');
  b.runDaily();
  const ext = mailsTo(b, 'contractor@example.com');
  assert.equal(ext.length, 1);
  assert.match(ext[0].body, /Due this month \(1\)/);
  assert.doesNotMatch(ext[0].body, /app\.example\.com/);
});

test('warning X days before due, once per due date', () => {
  const b = setUp();
  const obj = makeObject(b);
  makeObligation(b, obj.id, { ...YEARLY, rule_month: 3, warn_days_before: 10 });
  b.state.mails = [];
  b.setNow('2027-03-04T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.filter((m) => /Due on/.test(m.subject)).length, 0);
  b.setNow('2027-03-05T06:00:00Z');
  b.runDaily();
  b.setNow('2027-03-06T06:00:00Z');
  b.runDaily();
  const w = b.state.mails.filter((m) => /Due on 15\.03\.2027/.test(m.subject));
  assert.equal(w.length, 1);
});

test('snooze reminder: sent on its day to its author, does not change the due date', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  b.setNow('2027-01-04T06:00:00Z');
  const s = b.ok('snooze', OWNER, { obligation_id: o.id, days: 3, note: 'Call the contractor' });
  assert.equal(s.remind_on, '2027-01-07');
  assert.equal(b.call('snooze', OWNER, { obligation_id: o.id, remind_on: '2027-01-04' }).ok, false);
  b.state.mails = [];
  b.setNow('2027-01-06T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.filter((m) => m.subject.includes('Reminder')).length, 0);
  b.setNow('2027-01-08T06:00:00Z'); // a missed day is caught up
  b.runDaily();
  const r = b.state.mails.filter((m) => m.subject.includes('Reminder'));
  assert.equal(r.length, 1);
  assert.match(r[0].body, /Call the contractor/);
  b.setNow('2027-01-09T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.filter((m) => m.subject.includes('Reminder')).length, 1);
  assert.equal(b.ok('bootstrap', OWNER).obligations[0].next_due, '2027-01-15');
});

test('marking done cancels open reminders of that obligation', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  b.setNow('2027-01-04T06:00:00Z');
  b.ok('snooze', OWNER, { obligation_id: o.id, days: 3 });
  b.ok('markDone', OWNER, { obligation_id: o.id, done_date: '2027-01-04' });
  assert.equal(b.ok('bootstrap', OWNER).snoozes.length, 0);
});

test('weekly overdue reminder on Mondays only, users only', () => {
  const b = setUp();
  const obj = makeObject(b);
  makeObligation(b, obj.id, { ...YEARLY, extra_recipients: [{ email: 'ext@example.com' }] });
  b.setNow('2027-01-05T06:00:00Z');
  b.runDaily(); // monthly
  b.state.mails = [];
  b.setNow('2027-01-17T06:00:00Z'); // Sunday
  b.runDaily();
  assert.equal(b.state.mails.length, 0);
  b.setNow('2027-01-18T06:00:00Z'); // Monday
  b.runDaily();
  assert.equal(b.state.mails.length, 1);
  assert.equal(b.state.mails[0].to, OWNER);
  assert.match(b.state.mails[0].subject, /Overdue obligations \(1\)/);
});

test('daily job records status; a failing e-mail is logged and reported, others still go', () => {
  const b = setUp();
  b.ok('saveUser', OWNER, { email: USER, display_name: 'User', role: 'User' });
  b.state.failMailTo = USER;
  b.setNow('2027-01-04T06:00:00Z');
  b.runDaily();
  const st = b.ok('status', OWNER);
  assert.equal(st.status.last_daily_run_ok, 'false');
  assert.match(st.status.last_error, /user@example.com/);
  assert.ok(st.recentMail.some((m) => m.ok === 'false' && m.recipient === USER));
  assert.ok(b.state.mails.some((m) => m.subject === 'Servisi: daily check failed'));
  // after the problem is gone, the failed monthly e-mail is retried
  b.state.failMailTo = null;
  b.setNow('2027-01-05T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.filter((m) => m.to === USER && /Obligations for/.test(m.subject)).length, 1);
  assert.equal(b.ok('status', OWNER).status.last_daily_run_ok, 'true');
});

test('daily job repairs a wrong cached due date', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  const t = b.ctx.db_().table('Obligations');
  t.update(o.id, t.get(o.id).org_id, { next_due: '2030-01-01' }, 'test');
  b.runDaily();
  b.ctx.resetDbCache_();
  assert.equal(b.ok('bootstrap', OWNER).obligations[0].next_due, '2027-01-15');
});

// ------------------------------------------------------------------ storage

test('upload: owner users and storage clients, files land in their own folder', () => {
  const b = setUp();
  const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
  const up = b.ok('upload', OWNER, { mime: 'application/pdf', date: '2027-01-04', kind: 'Report', objectFolder: 'K1 Boiler', base64: pdf, fileName: 'r.pdf' });
  assert.match(up.url, /^https:\/\/drive\.google\.com\//);
  assert.match(up.file_name, /^2027-01-04_Report_[0-9a-f-]{36}\.pdf$/);
  let r = b.call('upload', 'client@example.com', { mime: 'application/pdf', date: '2027-01-04', base64: pdf });
  assert.equal(r.error.code, 'FORBIDDEN');
  b.ok('saveStorageClient', OWNER, { email: 'client@example.com', org_label: 'Other agency' });
  b.ok('upload', 'client@example.com', { mime: 'image/jpeg', date: '2027-01-04', kind: 'Photo', objectFolder: 'S1', base64: pdf });
  const root = b.state.drive.items[b.state.props.ATTACHMENTS_ROOT_ID];
  assert.deepEqual(root.folders.map((f) => f.name).sort(), ['Other agency', 'Test Org']);
  const clientFolder = root.folders.find((f) => f.name === 'Other agency');
  assert.deepEqual(clientFolder.viewers, ['client@example.com']);
  r = b.call('upload', OWNER, { mime: 'text/html', date: '2027-01-04', base64: pdf });
  assert.equal(r.ok, false);
});

// ------------------------------------------------------------------ export / import

test('export contains every table; import into an empty deployment reproduces the data', () => {
  const a = setUp();
  a.setNow('2027-03-10T08:00:00Z');
  const obj = makeObject(a);
  const o = makeObligation(a, obj.id, YEARLY);
  a.ok('markDone', OWNER, { obligation_id: o.id, done_date: '2027-03-01' });
  const exp = a.ok('exportData', OWNER);
  const files = JSON.parse(Buffer.from(exp.base64, 'base64').toString('utf8'));
  const names = files.map((f) => f.name);
  assert.ok(names.includes('data.json') && names.includes('README.txt') && names.includes('csv/Obligations.csv'));
  const data = JSON.parse(files.find((f) => f.name === 'data.json').data);

  const b = createBackend({ owner: 'new@example.com' });
  b.setNow('2027-03-10T08:00:00Z');
  b.ok('setup', 'new@example.com', { orgName: 'New Org' });
  const res = b.ok('importData', 'new@example.com', { data });
  assert.equal(res.imported.Objects, 1);
  const boot = b.ok('bootstrap', 'new@example.com');
  const imported = boot.obligations.find((x) => x.id === o.id);
  assert.equal(imported.next_due, '2028-01-15');
  assert.equal(boot.objects[0].created_by, OWNER);
  assert.equal(b.call('importData', 'new@example.com', { data }).ok, false, 'second import refused');
});

// ------------------------------------------------------------------ language

test('Slovenian (default): e-mails and error messages', () => {
  const b = createBackend();
  b.ok('setup', OWNER, { orgName: 'Test Org', appUrl: 'https://app.example.com' });
  assert.equal(b.ok('bootstrap', OWNER).settings.language, 'sl');
  const obj = makeObject(b);
  makeObligation(b, obj.id, { ...YEARLY, warn_days_before: 20 });
  b.setNow('2027-01-04T06:00:00Z');
  b.runDaily();
  const monthly = b.state.mails.find((m) => /Obveznosti za 01\/2027/.test(m.subject));
  assert.ok(monthly, 'monthly e-mail in Slovenian');
  assert.match(monthly.body, /Zapade ta mesec \(1\)/);
  assert.match(monthly.htmlBody, /ne daje pravnih nasvetov/);
  assert.ok(b.state.mails.some((m) => /Rok 15\.01\.2027/.test(m.subject)), 'warning in Slovenian');
  // error messages follow the language of the request
  const raw = (lang) => JSON.parse(b.ctx.doPost({ postData: { contents: JSON.stringify({
    action: 'saveObject', idToken: `fake:${OWNER}:${b.state.clientId}`, data: { code: 'X', name: '' }, lang }) } }).getContent());
  assert.equal(raw('sl').error.message, 'Ime je obvezen podatek.');
  assert.equal(raw('en').error.message, 'Name is required.');
  b.ok('saveSettings', OWNER, { values: { language: 'en' } });
  assert.equal(b.call('saveSettings', OWNER, { values: { language: 'de' } }).ok, false);
});

test('notifications go to the work address when set; sign-in stays with the Google account', () => {
  const b = setUp();
  b.ok('saveUser', OWNER, { email: USER, display_name: 'User', role: 'User', notify_email: 'User@Work.example' });
  assert.equal(b.call('saveUser', OWNER, { email: 'x@example.com', notify_email: 'not-an-email' }).ok, false);
  const user = b.ok('bootstrap', OWNER).users.find((u) => u.email === USER);
  const obj = makeObject(b, OWNER, { responsible_user_id: user.id });
  const o = makeObligation(b, obj.id, YEARLY);
  b.setNow('2027-01-04T06:00:00Z');
  b.ok('snooze', USER, { obligation_id: o.id, days: 1 });
  b.runDaily();
  b.setNow('2027-01-05T06:00:00Z');
  b.runDaily();
  assert.equal(b.state.mails.filter((m) => m.to === USER).length, 0);
  const work = b.state.mails.filter((m) => m.to === 'user@work.example');
  assert.ok(work.some((m) => /Obligations for/.test(m.subject)), 'monthly to work address');
  assert.ok(work.some((m) => /Reminder/.test(m.subject)), 'reminder to work address');
  assert.equal(b.ok('bootstrap', USER).me.email, USER);
});

test('schema migration: an older sheet gets new columns on the first request', () => {
  const b = setUp();
  const sheet = b.spreadsheet().getSheetByName('Users');
  const col = sheet.cells[0].indexOf('notify_email');
  sheet.cells.forEach((row) => row.splice(col, 1)); // as deployed before the column existed
  b.state.props.SCHEMA_VERSION = '1';
  assert.ok(b.ok('bootstrap', OWNER).me);
  assert.ok(sheet.cells[0].includes('notify_email'));
});

test('quote request: sent with reply-to and copy to the user, or recorded as draft; both in history', () => {
  const b = setUp();
  b.ok('saveUser', OWNER, { id: b.ok('bootstrap', OWNER).me.id, email: OWNER, role: 'Admin', notify_email: 'me@work.example' });
  const obj = makeObject(b);
  const o = makeObligation(b, obj.id, YEARLY);
  b.state.mails = [];
  b.ok('requestQuote', OWNER, { obligation_id: o.id, method: 'send', to: 'Contractor@Example.com', subject: 'Offer please', body: 'Text' });
  assert.equal(b.state.mails.length, 1);
  assert.equal(b.state.mails[0].to, 'contractor@example.com');
  assert.equal(b.state.mails[0].replyTo, 'me@work.example');
  assert.equal(b.state.mails[0].cc, 'me@work.example');
  b.ok('requestQuote', OWNER, { obligation_id: o.id, method: 'draft', to: 'contractor@example.com', subject: 'S', body: 'B' });
  assert.equal(b.state.mails.length, 1, 'draft is not sent by the app');
  const h = b.ok('history', OWNER, { obligation_id: o.id });
  assert.deepEqual(h.quotes.map((q) => q.method).sort().join(','), 'draft,send');
  b.state.mails = [];
  b.ok('requestQuote', OWNER, { obligation_id: o.id, method: 'self', to: 'ignored@example.com', subject: 'Fwd me', body: 'Clean text' });
  assert.equal(b.state.mails.length, 1);
  assert.equal(b.state.mails[0].to, 'me@work.example', 'sent to the work address for forwarding');
  assert.equal(b.state.mails[0].body, 'Clean text', 'body is exactly the request, nothing added');
  assert.equal(b.state.mails[0].cc, undefined);
  assert.equal(b.call('requestQuote', OWNER, { obligation_id: o.id, method: 'send', to: 'bad', subject: 'S', body: 'B' }).ok, false);
  b.state.failMailTo = 'x@example.com';
  const r = b.call('requestQuote', OWNER, { obligation_id: o.id, method: 'send', to: 'x@example.com', subject: 'S', body: 'B' });
  assert.equal(r.error.code, 'MAIL');
  assert.equal(b.ok('history', OWNER, { obligation_id: o.id }).quotes.length, 3, 'failed send is not recorded as a request');
});

test('objects: code is optional; kind can be typed and is added once', () => {
  const b = setUp();
  const a = b.ok('saveObject', OWNER, { name: 'Toplarna', kind_name: 'Toplarna' });
  assert.equal(a.code, '');
  const b2 = b.ok('saveObject', OWNER, { name: 'Toplarna 2', kind_name: 'toplarna' });
  assert.equal(b2.kind_id, a.kind_id, 'same kind reused, case-insensitive');
  const boot = b.ok('bootstrap', OWNER);
  assert.equal(boot.objectKinds.filter((k) => k.name.toLowerCase() === 'toplarna').length, 1);
  b.ok('saveObject', OWNER, { name: 'Brez oznake' }); // two objects without code are fine
  const c = b.ok('saveObject', OWNER, { id: a.id, rev: a.rev, name: 'Toplarna', kind_name: '' });
  assert.equal(c.kind_id, '');
  assert.equal(b.call('saveObject', OWNER, { name: '' }).ok, false);
});

test('obligation: type and contractor can be typed; new ones are added to the lists', () => {
  const b = setUp();
  const obj = makeObject(b);
  const o = b.ok('saveObligation', OWNER, { object_id: obj.id, type_name: 'Servis toplotne črpalke',
    contractor_name: 'Termo d.o.o.', contractor_email: 'Info@Termo.example', contractor_phone: '041 1', ...YEARLY });
  let boot = b.ok('bootstrap', OWNER);
  const ty = boot.obligationTypes.find((x) => x.id === o.type_id);
  assert.equal(ty.name, 'Servis toplotne črpalke');
  assert.equal(ty.is_suggestion, 'false');
  const c = boot.contractors.find((x) => x.id === o.contractor_id);
  assert.equal(c.email, 'info@termo.example');
  const o2 = b.ok('saveObligation', OWNER, { object_id: obj.id, type_name: 'servis toplotne ČRPALKE',
    contractor_name: 'termo d.o.o.', contractor_phone: '041 2', ...YEARLY });
  boot = b.ok('bootstrap', OWNER);
  assert.equal(o2.type_id, o.type_id, 'existing type reused');
  assert.equal(o2.contractor_id, o.contractor_id, 'existing contractor reused');
  assert.equal(boot.contractors.find((x) => x.id === o.contractor_id).phone, '041 2', 'phone updated');
  assert.equal(boot.contractors.filter((x) => x.name.toLowerCase() === 'termo d.o.o.').length, 1);
  const o3 = b.ok('saveObligation', OWNER, { id: o2.id, rev: o2.rev, object_id: obj.id, type_id: o.type_id, contractor_name: '', ...YEARLY });
  assert.equal(o3.contractor_id, '');
  assert.equal(b.call('saveObligation', OWNER, { object_id: obj.id, type_name: '', ...YEARLY }).ok, false);
});

test('RequestLog: failures and slow requests are logged, fast ones and sign-in errors are not', () => {
  const b = setUp();
  const rows = () => b.ctx.db_().table('RequestLog').list('');
  b.ok('bootstrap', OWNER);
  b.call('bootstrap', 'nobody@example.com', {}, 'wrong-audience');
  assert.equal(rows().length, 0);
  b.call('history', OWNER, { obligation_id: 'missing' });
  assert.equal(rows().length, 1);
  assert.equal(rows()[0].action, 'history');
  assert.equal(rows()[0].ok, 'false');
  assert.match(rows()[0].phases, /auth=\d+ user=\d+/);
  require('node:vm').runInContext('SLOW_REQUEST_MS = -1;', b.ctx);
  b.ok('bootstrap', OWNER);
  assert.equal(rows().length, 2);
  assert.equal(rows()[1].ok, 'true');
  assert.match(rows()[1].phases, /done=\d+$/);
});

test('sessions: a Google sign-in returns a 30-day session token that replaces it', () => {
  const b = setUp();
  const raw = (action, idToken) => JSON.parse(b.ctx.doPost({ postData: { contents: JSON.stringify({ action, idToken, data: {} }) } }).getContent());
  const first = b.call('bootstrap', OWNER);
  assert.ok(first.session && first.session.startsWith('s1.'));
  const r = raw('bootstrap', first.session);
  assert.equal(r.ok, true);
  assert.equal(r.data.me.email, OWNER);
  assert.equal(r.session, undefined, 'a fresh session is not renewed');
  // Tampered: another e-mail in the payload with the old signature.
  const [, , sig] = first.session.split('.');
  const forged = 's1.' + Buffer.from(JSON.stringify({ e: USER, x: 9999999999, a: b.state.clientId })).toString('base64url') + '.' + sig;
  assert.equal(raw('bootstrap', forged).error.code, 'AUTH');
  assert.equal(raw('bootstrap', first.session + 'x').error.code, 'AUTH');
  // Old session is renewed, expired one is refused.
  const start = b.state.now.getTime();
  b.setNow(new Date(start + 20 * 86400000).toISOString());
  const renewed = raw('bootstrap', first.session);
  assert.equal(renewed.ok, true);
  assert.ok(renewed.session && renewed.session !== first.session);
  b.setNow(new Date(start + 31 * 86400000).toISOString());
  assert.equal(raw('bootstrap', first.session).error.code, 'AUTH');
  assert.equal(raw('bootstrap', renewed.session).ok, true);
});

test('sessions: removing a user from the access list takes effect at once', () => {
  const b = setUp();
  const boot = b.ok('bootstrap', OWNER);
  b.ok('saveUser', OWNER, { email: USER, display_name: 'U', role: 'User', active: 'true' });
  const s = b.call('bootstrap', USER).session;
  const raw = (idToken) => JSON.parse(b.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'bootstrap', idToken, data: {} }) } }).getContent());
  assert.equal(raw(s).ok, true);
  const u = b.ok('bootstrap', OWNER).users.find((x) => x.email === USER);
  b.ok('saveUser', OWNER, { id: u.id, rev: u.rev, email: USER, display_name: 'U', role: 'User', active: 'false' });
  assert.equal(raw(s).error.code, 'FORBIDDEN');
  assert.ok(boot);
});
