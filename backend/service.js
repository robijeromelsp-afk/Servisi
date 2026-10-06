/**
 * Business actions behind the API. Each receives ctx = { user, email, orgId, tz, today }.
 */

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var CATALOGS = { ObjectKinds: 'Admin', ObligationGroups: 'Admin', ObligationTypes: 'Admin', Contractors: 'User' };
var SETTING_KEYS = ['monthly_day', 'run_hour', 'weekly_overdue_reminder', 'app_url', 'storage_url', 'mail_sender_name', 'language',
  'quote_subject', 'quote_body'];

function t_(name) {
  return db_().table(name);
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function requireText_(v, label) {
  var s = str_(v);
  if (!s) throw appError_('INVALID', label + ' is required.');
  return s;
}

// ------------------------------------------------------------------ schedule glue

function ruleOf_(o) {
  return {
    type: o.rule_type, weekday: o.rule_weekday, interval: o.rule_interval, day: o.rule_day,
    months: o.rule_months, month: o.rule_month, start: o.start_date, countFrom: o.count_from,
    lastDoneBeforeApp: o.last_done_before_app
  };
}

function completionsByObligation_(orgId) {
  var map = {};
  t_('Completions').list(orgId).forEach(function (c) {
    if (c.void_at) return;
    (map[c.obligation_id] = map[c.obligation_id] || []).push({ id: c.id, doneDate: c.done_date, order: c.created_at });
  });
  return map;
}

function computeObligation_(o, completions) {
  var r = Schedule.compute(ruleOf_(o), completions || []);
  return { result: r, next_due: r.nextDue || '', status: r.complete ? 'Active' : 'Incomplete' };
}

/** Recomputes the cached next_due/status of one obligation and stores it if it changed. */
function refreshObligation_(ctx, obligationId, actor) {
  var o = t_('Obligations').require(obligationId, ctx.orgId, 'Obligation');
  var c = computeObligation_(o, completionsByObligation_(ctx.orgId)[o.id]);
  if (c.next_due !== o.next_due || c.status !== o.status) {
    o = t_('Obligations').update(o.id, ctx.orgId, { next_due: c.next_due, status: c.status }, actor || ctx.email);
  }
  return o;
}

// ------------------------------------------------------------------ bootstrap

function apiBootstrap_(ctx) {
  var org = orgOf_(ctx.orgId);
  var settings = kvAll_('Settings', ctx.orgId);
  var status = kvAll_('Status', ctx.orgId);
  return {
    version: APP_VERSION,
    today: ctx.today,
    org: { id: org.id, name: org.name, timezone: org.timezone },
    me: { id: ctx.user.id, email: ctx.user.email, display_name: ctx.user.display_name, role: ctx.user.role,
      notify_email: ctx.user.notify_email },
    settings: settings,
    status: { last_daily_run_at: status.last_daily_run_at || '', last_daily_run_ok: status.last_daily_run_ok || '' },
    users: t_('Users').list(ctx.orgId, { includeArchived: true }).map(function (u) {
      return { id: u.id, email: u.email, display_name: u.display_name, role: u.role, active: u.active,
        notify_email: u.notify_email, archived_at: u.archived_at, rev: u.rev };
    }),
    objectKinds: t_('ObjectKinds').list(ctx.orgId, { includeArchived: true }),
    obligationGroups: t_('ObligationGroups').list(ctx.orgId, { includeArchived: true }),
    obligationTypes: t_('ObligationTypes').list(ctx.orgId, { includeArchived: true }),
    contractors: t_('Contractors').list(ctx.orgId, { includeArchived: true }),
    objects: t_('Objects').list(ctx.orgId, { includeArchived: true }),
    obligations: t_('Obligations').list(ctx.orgId, { includeArchived: true }),
    snoozes: t_('Snoozes').list(ctx.orgId).filter(function (s) { return !s.sent_at && !s.cancelled_at; }),
    storageClients: ctx.user.role === 'Admin' ? t_('StorageClients').list(ctx.orgId) : []
  };
}

// ------------------------------------------------------------------ objects

function apiSaveObject_(ctx, d) {
  var rec = {
    code: str_(d.code),
    name: requireText_(d.name, 'Name'),
    address: str_(d.address),
    kind_id: str_(d.kind_id),
    responsible_user_id: str_(d.responsible_user_id),
    site_contact: str_(d.site_contact),
    note: str_(d.note)
  };
  // The kind may be typed freely: an existing kind with that name is used, otherwise it is added.
  if (d.kind_name !== undefined) {
    var kindName = str_(d.kind_name);
    rec.kind_id = '';
    if (kindName) {
      var kinds = t_('ObjectKinds').list(ctx.orgId, { includeArchived: true });
      var found = kinds.filter(function (k) { return k.name.toLowerCase() === kindName.toLowerCase(); })[0];
      if (found && found.archived_at) found = t_('ObjectKinds').restore(found.id, ctx.orgId, ctx.email);
      if (!found) found = t_('ObjectKinds').insert(ctx.orgId, { name: kindName, sort: String((kinds.length + 1) * 10) }, ctx.email);
      rec.kind_id = found.id;
    }
  }
  if (rec.kind_id) t_('ObjectKinds').require(rec.kind_id, ctx.orgId, 'Object kind');
  if (rec.responsible_user_id) t_('Users').require(rec.responsible_user_id, ctx.orgId, 'Responsible user');
  if (rec.code) {
    var dup = t_('Objects').list(ctx.orgId).filter(function (o) {
      return o.id !== d.id && o.code.toLowerCase() === rec.code.toLowerCase();
    });
    if (dup.length) throw appError_('INVALID', 'Another active object already has code ' + rec.code + '.');
  }
  if (d.id) return t_('Objects').update(d.id, ctx.orgId, rec, ctx.email, d.rev);
  return t_('Objects').insert(ctx.orgId, rec, ctx.email);
}

/** Archives the object and its active obligations; remembers which ones went with it. */
function apiArchiveObject_(ctx, d) {
  var obj = t_('Objects').require(d.id, ctx.orgId, 'Object');
  var reason = requireText_(d.reason, 'Reason');
  t_('Obligations').list(ctx.orgId).filter(function (o) { return o.object_id === obj.id; }).forEach(function (o) {
    t_('Obligations').update(o.id, ctx.orgId, { archived_with_object: obj.id }, ctx.email);
    t_('Obligations').archive(o.id, ctx.orgId, ctx.email, 'Archived with object: ' + reason);
  });
  return t_('Objects').archive(obj.id, ctx.orgId, ctx.email, reason, d.rev);
}

function apiRestoreObject_(ctx, d) {
  var obj = t_('Objects').restore(d.id, ctx.orgId, ctx.email, d.rev);
  t_('Obligations').list(ctx.orgId, { includeArchived: true }).filter(function (o) {
    return o.archived_with_object === obj.id;
  }).forEach(function (o) {
    t_('Obligations').restore(o.id, ctx.orgId, ctx.email);
    t_('Obligations').update(o.id, ctx.orgId, { archived_with_object: '' }, ctx.email);
    refreshObligation_(ctx, o.id);
  });
  return obj;
}

// ------------------------------------------------------------------ obligations

function intOrEmpty_(v, lo, hi, label) {
  var s = str_(v);
  if (!s) return '';
  var n = Number(s);
  if (!Number.isInteger(n) || n < lo || n > hi) throw appError_('INVALID', label + ' must be ' + lo + ' to ' + hi + '.');
  return String(n);
}

function dateOrEmpty_(v, label) {
  var s = str_(v);
  if (s && !Schedule.isDate(s)) throw appError_('INVALID', label + ' is not a valid date (YYYY-MM-DD).');
  return s;
}

/** extra_recipients: list of { userId } or { email }. Stored as JSON. */
function normalizeRecipients_(ctx, list) {
  if (typeof list === 'string') list = list ? JSON.parse(list) : [];
  var out = [];
  (list || []).forEach(function (r) {
    if (r.userId) {
      t_('Users').require(r.userId, ctx.orgId, 'Recipient');
      out.push({ userId: r.userId });
    } else if (r.email) {
      var e = str_(r.email).toLowerCase();
      if (!EMAIL_RE.test(e)) throw appError_('INVALID', 'Recipient e-mail is not valid: ' + e);
      out.push({ email: e });
    }
  });
  return JSON.stringify(out);
}

function apiSaveObligation_(ctx, d) {
  var obj = t_('Objects').require(str_(d.object_id), ctx.orgId, 'Object');
  if (obj.archived_at) throw appError_('INVALID', 'The object is archived.');
  var rec = {
    object_id: obj.id,
    type_id: requireText_(d.type_id, 'Obligation type'),
    contractor_id: str_(d.contractor_id),
    note: str_(d.note),
    rule_type: str_(d.rule_type),
    rule_weekday: intOrEmpty_(d.rule_weekday, 1, 7, 'Weekday'),
    rule_interval: intOrEmpty_(d.rule_interval, 1, 3650, 'Interval'),
    rule_day: intOrEmpty_(d.rule_day, 1, 28, 'Day of month'),
    rule_months: Schedule.normalize({ months: d.rule_months }).months.join(','),
    rule_month: intOrEmpty_(d.rule_month, 1, 12, 'Month'),
    start_date: dateOrEmpty_(d.start_date, 'Start date'),
    count_from: str_(d.count_from),
    last_done_before_app: dateOrEmpty_(d.last_done_before_app, 'Last done date'),
    warn_days_before: intOrEmpty_(d.warn_days_before, 0, 365, 'Warning days'),
    extra_recipients: normalizeRecipients_(ctx, d.extra_recipients)
  };
  if (rec.rule_type && Schedule.TYPES.indexOf(rec.rule_type) < 0) throw appError_('INVALID', 'Unknown repeat type.');
  if (rec.count_from && Schedule.COUNT_FROM.indexOf(rec.count_from) < 0) throw appError_('INVALID', 'Unknown counting mode.');
  if (rec.last_done_before_app && rec.last_done_before_app > ctx.today) {
    throw appError_('INVALID', 'Last done date cannot be in the future.');
  }
  t_('ObligationTypes').require(rec.type_id, ctx.orgId, 'Obligation type');
  if (rec.contractor_id) t_('Contractors').require(rec.contractor_id, ctx.orgId, 'Contractor');

  var completions = d.id ? completionsByObligation_(ctx.orgId)[d.id] : [];
  var c = computeObligation_(rec, completions);
  rec.next_due = c.next_due;
  rec.status = c.status;
  if (d.id) {
    var cur = t_('Obligations').require(d.id, ctx.orgId, 'Obligation');
    if (cur.archived_at) throw appError_('INVALID', 'The obligation is archived.');
    return t_('Obligations').update(d.id, ctx.orgId, rec, ctx.email, d.rev);
  }
  return t_('Obligations').insert(ctx.orgId, rec, ctx.email);
}

function apiArchiveObligation_(ctx, d) {
  return t_('Obligations').archive(d.id, ctx.orgId, ctx.email, requireText_(d.reason, 'Reason'), d.rev);
}

function apiRestoreObligation_(ctx, d) {
  var o = t_('Obligations').require(d.id, ctx.orgId, 'Obligation');
  var obj = t_('Objects').require(o.object_id, ctx.orgId, 'Object');
  if (obj.archived_at) throw appError_('INVALID', 'Restore the object first.');
  t_('Obligations').restore(o.id, ctx.orgId, ctx.email, d.rev);
  if (o.archived_with_object) t_('Obligations').update(o.id, ctx.orgId, { archived_with_object: '' }, ctx.email);
  return refreshObligation_(ctx, o.id);
}

// ------------------------------------------------------------------ completions

var ATTACHMENT_KINDS = ['Report', 'Invoice', 'Photo', 'Measurement', 'Other'];

function apiMarkDone_(ctx, d) {
  var o = t_('Obligations').require(str_(d.obligation_id), ctx.orgId, 'Obligation');
  if (o.archived_at) throw appError_('INVALID', 'The obligation is archived.');
  var doneDate = dateOrEmpty_(d.done_date, 'Date done');
  if (!doneDate) throw appError_('INVALID', 'Date done is required.');
  if (doneDate > ctx.today) throw appError_('INVALID', 'Date done cannot be in the future.');
  var before = computeObligation_(o, completionsByObligation_(ctx.orgId)[o.id]);
  if (!before.result.complete) throw appError_('INVALID', 'Complete the repeat settings of this obligation first.');
  if (d.expected_due && d.expected_due !== before.next_due) {
    throw appError_('CONFLICT', 'The due date changed in the meantime (now ' + before.next_due + '). Reload and try again.');
  }
  var attachments = (d.attachments || []).map(function (a) {
    var url = str_(a.url);
    if (!/^https:\/\/(drive|docs)\.google\.com\//.test(url)) throw appError_('INVALID', 'Attachment link is not a Google Drive link.');
    return {
      drive_file_id: requireText_(a.drive_file_id, 'Attachment file id'),
      url: url,
      file_name: str_(a.file_name),
      mime: str_(a.mime),
      size_bytes: str_(a.size_bytes),
      original_size_bytes: str_(a.original_size_bytes),
      kind: ATTACHMENT_KINDS.indexOf(a.kind) >= 0 ? a.kind : 'Other'
    };
  });
  var completion = t_('Completions').insert(ctx.orgId, {
    obligation_id: o.id, due_date: before.next_due, done_date: doneDate, done_by: ctx.email, note: str_(d.note)
  }, ctx.email);
  attachments.forEach(function (a) {
    a.completion_id = completion.id;
    a.obligation_id = o.id;
    t_('Attachments').insert(ctx.orgId, a, ctx.email);
  });
  // A reminder for this obligation is obsolete once it is done.
  t_('Snoozes').list(ctx.orgId).forEach(function (s) {
    if (s.obligation_id === o.id && !s.sent_at && !s.cancelled_at) {
      t_('Snoozes').update(s.id, ctx.orgId, { cancelled_at: nowIso_(), cancelled_by: 'marked done' }, ctx.email);
    }
  });
  return { completion: completion, obligation: refreshObligation_(ctx, o.id) };
}

function apiVoidCompletion_(ctx, d) {
  var c = t_('Completions').require(str_(d.id), ctx.orgId, 'Completion');
  if (c.void_at) throw appError_('INVALID', 'Already voided.');
  t_('Completions').update(c.id, ctx.orgId, {
    void_at: nowIso_(), void_by: ctx.email, void_reason: requireText_(d.reason, 'Reason')
  }, ctx.email, d.rev, 'void');
  return { obligation: refreshObligation_(ctx, c.obligation_id) };
}

/** Full history of one obligation, including computed skipped due dates. */
function apiHistory_(ctx, d) {
  var o = t_('Obligations').require(str_(d.obligation_id), ctx.orgId, 'Obligation');
  var completions = t_('Completions').list(ctx.orgId).filter(function (c) { return c.obligation_id === o.id; });
  var attachments = t_('Attachments').list(ctx.orgId).filter(function (a) { return a.obligation_id === o.id; });
  var computed = computeObligation_(o, completionsByObligation_(ctx.orgId)[o.id]).result;
  return {
    obligation: o,
    completions: completions,
    attachments: attachments,
    computed: computed,
    snoozes: t_('Snoozes').list(ctx.orgId).filter(function (s) { return s.obligation_id === o.id; }),
    quotes: t_('QuoteRequests').list(ctx.orgId).filter(function (q) { return q.obligation_id === o.id; })
  };
}

// ------------------------------------------------------------------ quote requests

/**
 * Request for a quote to a contractor. The text is prepared and edited in the page.
 * method 'send': sent by this deployment, reply-to and copy to the user's notification address.
 * method 'self': sent to the user's own notification address, ready to forward to contractors.
 * method 'draft': the user opened it in their own e-mail program; only recorded here.
 */
function apiRequestQuote_(ctx, d) {
  var o = t_('Obligations').require(str_(d.obligation_id), ctx.orgId, 'Obligation');
  var method = ['send', 'self', 'draft'].indexOf(d.method) >= 0 ? d.method : 'draft';
  // 'self': ready-to-forward copy to the user's own notification address (e.g. work e-mail).
  var to = method === 'self' ? [mailOf_(ctx.user)] : str_(d.to).toLowerCase().split(/[\s,;]+/).filter(Boolean);
  if (!to.length) throw appError_('INVALID', 'Recipient is required.');
  to.forEach(function (e) { if (!EMAIL_RE.test(e)) throw appError_('INVALID', 'Recipient e-mail is not valid: ' + e); });
  var subject = requireText_(d.subject, 'Subject');
  var body = requireText_(d.body, 'Text');
  if (method === 'send' || method === 'self') {
    var me = mailOf_(ctx.user);
    var settings = kvAll_('Settings', ctx.orgId);
    var entry = { kind: 'Quote', period: ctx.today, recipient: to.join(','), ref_id: o.id, items: '1', sent_at: nowIso_() };
    try {
      var msg = { to: to.join(','), replyTo: me, subject: subject, body: body, name: settings.mail_sender_name || 'Servisi' };
      if (method === 'send') msg.cc = me;
      MailApp.sendEmail(msg);
      entry.ok = 'true';
      entry.error = '';
    } catch (e) {
      entry.ok = 'false';
      entry.error = String(e.message || e);
    }
    t_('MailLog').insert(ctx.orgId, entry, ctx.email);
    if (entry.ok !== 'true') throw appError_('MAIL', 'The e-mail could not be sent: ' + entry.error);
  }
  return t_('QuoteRequests').insert(ctx.orgId, {
    obligation_id: o.id, contractor_id: o.contractor_id, recipient: to.join(', '), subject: subject, body: body,
    method: method, sent_at: nowIso_()
  }, ctx.email);
}

// ------------------------------------------------------------------ snoozes

function apiSnooze_(ctx, d) {
  var o = t_('Obligations').require(str_(d.obligation_id), ctx.orgId, 'Obligation');
  var on = str_(d.remind_on);
  if (!on && d.days) on = Schedule.addDays(ctx.today, parseInt(intOrEmpty_(d.days, 1, 366, 'Days'), 10));
  on = dateOrEmpty_(on, 'Reminder date');
  if (!on) throw appError_('INVALID', 'Enter the number of days or a date.');
  if (on <= ctx.today) throw appError_('INVALID', 'The reminder date must be after today.');
  return t_('Snoozes').insert(ctx.orgId, { obligation_id: o.id, remind_on: on, note: str_(d.note) }, ctx.email);
}

function apiCancelSnooze_(ctx, d) {
  var s = t_('Snoozes').require(str_(d.id), ctx.orgId, 'Reminder');
  return t_('Snoozes').update(s.id, ctx.orgId, { cancelled_at: nowIso_(), cancelled_by: ctx.email }, ctx.email);
}

// ------------------------------------------------------------------ catalogs

function catalogTable_(ctx, name) {
  if (!CATALOGS[name]) throw appError_('BAD_REQUEST', 'Unknown list.');
  if (CATALOGS[name] === 'Admin' && ctx.user.role !== 'Admin') throw appError_('FORBIDDEN', 'Only an administrator can do this.');
  return t_(name);
}

function apiSaveCatalog_(ctx, d) {
  var table = catalogTable_(ctx, d.table);
  var rec = {};
  var f = d.record || {};
  rec.name = requireText_(f.name, 'Name');
  if (d.table === 'ObligationTypes') {
    rec.group_id = str_(f.group_id);
    if (rec.group_id) t_('ObligationGroups').require(rec.group_id, ctx.orgId, 'Group');
    rec.description = str_(f.description);
    rec.is_suggestion = f.is_suggestion === true || f.is_suggestion === 'true' ? 'true' : 'false';
  }
  if (d.table === 'Contractors') {
    rec.contact_person = str_(f.contact_person);
    rec.phone = str_(f.phone);
    rec.email = str_(f.email).toLowerCase();
    if (rec.email && !EMAIL_RE.test(rec.email)) throw appError_('INVALID', 'E-mail is not valid.');
    rec.note = str_(f.note);
  }
  if (d.table !== 'Contractors') rec.sort = intOrEmpty_(f.sort, 0, 100000, 'Sort');
  if (f.id) return table.update(f.id, ctx.orgId, rec, ctx.email, f.rev);
  return table.insert(ctx.orgId, rec, ctx.email);
}

function apiArchiveCatalog_(ctx, d) {
  return catalogTable_(ctx, d.table).archive(str_(d.id), ctx.orgId, ctx.email, str_(d.reason), d.rev);
}

function apiRestoreCatalog_(ctx, d) {
  return catalogTable_(ctx, d.table).restore(str_(d.id), ctx.orgId, ctx.email, d.rev);
}

// ------------------------------------------------------------------ users and settings

function activeAdmins_(orgId, exceptId) {
  return t_('Users').list(orgId).filter(function (u) {
    return u.role === 'Admin' && u.active === 'true' && u.id !== exceptId;
  });
}

function apiSaveUser_(ctx, d) {
  var email = requireText_(d.email, 'E-mail').toLowerCase();
  if (!EMAIL_RE.test(email)) throw appError_('INVALID', 'E-mail is not valid.');
  var role = d.role === 'Admin' ? 'Admin' : 'User';
  var active = d.active === false || d.active === 'false' ? 'false' : 'true';
  var clash = t_('Users').list(null, { includeArchived: true }).filter(function (u) {
    return u.email.toLowerCase() === email && u.id !== d.id;
  });
  if (clash.length) throw appError_('INVALID', 'This e-mail is already on the access list.');
  if (d.id && (role !== 'Admin' || active !== 'true') && !activeAdmins_(ctx.orgId, d.id).length) {
    throw appError_('INVALID', 'At least one active administrator is required.');
  }
  var notify = str_(d.notify_email).toLowerCase();
  if (notify && !EMAIL_RE.test(notify)) throw appError_('INVALID', 'E-mail for notifications is not valid.');
  var rec = { email: email, display_name: str_(d.display_name) || email, role: role, active: active, notify_email: notify };
  if (d.id) return t_('Users').update(d.id, ctx.orgId, rec, ctx.email, d.rev);
  return t_('Users').insert(ctx.orgId, rec, ctx.email);
}

function apiSaveSettings_(ctx, d) {
  var v = d.values || {};
  var out = {};
  SETTING_KEYS.forEach(function (k) {
    if (v[k] === undefined) return;
    var s = str_(v[k]);
    if (k === 'monthly_day') s = intOrEmpty_(s, 1, 28, 'Day of the monthly e-mail') || '1';
    if (k === 'run_hour') s = intOrEmpty_(s, 0, 23, 'Hour') || '6';
    if (k === 'weekly_overdue_reminder') s = s === 'true' ? 'true' : 'false';
    if (k === 'language' && LANGUAGES.indexOf(s) < 0) throw appError_('INVALID', 'Unknown language.');
    if ((k === 'app_url' || k === 'storage_url') && s && !/^(https:\/\/|http:\/\/localhost[:/])/.test(s)) {
      throw appError_('INVALID', 'Links must start with https://');
    }
    kvSet_('Settings', ctx.orgId, k, s, ctx.email);
    out[k] = s;
  });
  if (out.run_hour) installDailyTrigger_(parseInt(out.run_hour, 10));
  return kvAll_('Settings', ctx.orgId);
}

function apiSaveStorageClient_(ctx, d) {
  var email = requireText_(d.email, 'E-mail').toLowerCase();
  if (!EMAIL_RE.test(email)) throw appError_('INVALID', 'E-mail is not valid.');
  var rec = { email: email, org_label: requireText_(d.org_label, 'Organisation label') };
  if (d.id) return t_('StorageClients').update(d.id, ctx.orgId, rec, ctx.email, d.rev);
  return t_('StorageClients').insert(ctx.orgId, rec, ctx.email);
}

function apiArchiveStorageClient_(ctx, d) {
  return t_('StorageClients').archive(str_(d.id), ctx.orgId, ctx.email, str_(d.reason));
}

// ------------------------------------------------------------------ status and maintenance

function apiStatus_(ctx) {
  var log = t_('MailLog').list(ctx.orgId);
  return {
    status: kvAll_('Status', ctx.orgId),
    triggerInstalled: dailyTriggerInstalled_(),
    mailQuotaLeft: MailApp.getRemainingDailyQuota(),
    recentMail: log.slice(-50).reverse()
  };
}

function apiRunDailyJob_(ctx) {
  return runDailyForOrg_(ctx.orgId, { manual: true, by: ctx.email });
}

function apiInstallDailyTrigger_(ctx) {
  var hour = parseInt(kvGet_('Settings', ctx.orgId, 'run_hour') || '6', 10);
  installDailyTrigger_(hour);
  return { triggerInstalled: dailyTriggerInstalled_(), hour: hour };
}

function apiSendTestEmail_(ctx) {
  var settings = kvAll_('Settings', ctx.orgId);
  var to = mailOf_(ctx.user);
  sendMail_(ctx.orgId, 'Test', ctx.today, to, '', {
    subject: tr_(settings, 'testSubject'),
    html: '<p>' + esc_(tr_(settings, 'testLine1', { org: orgOf_(ctx.orgId).name })) + '</p>' +
      '<p>' + esc_(tr_(settings, 'testLine2')) + '</p>' + mailFooter_(settings),
    text: tr_(settings, 'testLine1', { org: orgOf_(ctx.orgId).name }) + ' ' + tr_(settings, 'testLine2')
  }, 0);
  return { sentTo: to };
}
