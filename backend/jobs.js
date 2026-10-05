/**
 * Daily job and e-mail.
 *
 * Runs every day (time-driven trigger) under the account of the deployment owner, so all
 * e-mail is sent from that account. Every step is tied to MailLog, not to a calendar day:
 * if the trigger misses a day, the next run catches up, nothing is lost.
 */

var TRIGGER_FUNCTION = 'dailyJob';

/** Entry point of the time-driven trigger. */
function dailyJob() {
  resetDbCache_();
  if (!prop_('SPREADSHEET_ID')) return;
  db_().ensureSchema();
  db_().table('Organizations').list(null).forEach(function (org) {
    runDailyForOrg_(org.id, { manual: false, by: 'daily job' });
  });
}

function installDailyTrigger_(hour) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TRIGGER_FUNCTION) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(TRIGGER_FUNCTION).timeBased().everyDays(1).atHour(hour).create();
}

function dailyTriggerInstalled_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === TRIGGER_FUNCTION; });
}

function runDailyForOrg_(orgId, opts) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(60000)) throw appError_('BUSY', 'Another run is in progress.');
  var actor = opts.by || 'daily job';
  var summary = { recomputed: 0, monthly: 0, warnings: 0, reminders: 0, weekly: 0, errors: [] };
  try {
    resetDbCache_();
    var tz = orgTimezone_(orgId);
    var today = today_(tz);
    var ctx = { orgId: orgId, tz: tz, today: today, email: actor };
    var step = function (name, fn) {
      try { fn(); } catch (e) { summary.errors.push(name + ': ' + e.message); console.error(e.stack || e); }
    };
    step('recompute', function () { summary.recomputed = recomputeAll_(ctx, actor); });
    var data = loadMailData_(ctx);
    step('monthly', function () { summary.monthly = sendMonthly_(ctx, data); });
    step('warnings', function () { summary.warnings = sendWarnings_(ctx, data); });
    step('reminders', function () { summary.reminders = sendReminders_(ctx, data); });
    step('weekly', function () { summary.weekly = sendWeeklyOverdue_(ctx, data); });
    kvSet_('Status', orgId, 'last_daily_run_at', nowIso_(), actor);
    kvSet_('Status', orgId, 'last_daily_run_ok', summary.errors.length ? 'false' : 'true', actor);
    kvSet_('Status', orgId, 'last_error', summary.errors.join(' | '), actor);
    kvSet_('Status', orgId, 'mail_quota_left', String(MailApp.getRemainingDailyQuota()), actor);
    if (summary.errors.length) notifyAdminsOfFailure_(ctx, summary.errors);
    return summary;
  } finally {
    lock.releaseLock();
  }
}

/** Recomputes next_due of every active obligation from its rule and history. */
function recomputeAll_(ctx, actor) {
  var byObl = completionsByObligation_(ctx.orgId);
  var n = 0;
  t_('Obligations').list(ctx.orgId).forEach(function (o) {
    var c = computeObligation_(o, byObl[o.id]);
    if (c.next_due !== o.next_due || c.status !== o.status) {
      t_('Obligations').update(o.id, ctx.orgId, { next_due: c.next_due, status: c.status }, actor);
      n++;
    }
  });
  return n;
}

// ------------------------------------------------------------------ recipients

function loadMailData_(ctx) {
  var index = function (list) {
    var m = {};
    list.forEach(function (x) { m[x.id] = x; });
    return m;
  };
  var users = t_('Users').list(ctx.orgId).filter(function (u) { return u.active === 'true'; });
  return {
    settings: kvAll_('Settings', ctx.orgId),
    org: orgOf_(ctx.orgId),
    users: index(users),
    admins: users.filter(function (u) { return u.role === 'Admin'; }),
    objects: index(t_('Objects').list(ctx.orgId)),
    types: index(t_('ObligationTypes').list(ctx.orgId, { includeArchived: true })),
    contractors: index(t_('Contractors').list(ctx.orgId, { includeArchived: true })),
    obligations: t_('Obligations').list(ctx.orgId),
    snoozes: t_('Snoozes').list(ctx.orgId),
    log: t_('MailLog').list(ctx.orgId)
  };
}

/**
 * Who receives an obligation: the responsible user of the object (or, if there is none,
 * every administrator, so nothing is left without a recipient) plus extra recipients.
 * Returns e-mail addresses with a flag whether the address is an application user.
 */
function recipientsOf_(o, data) {
  var out = {};
  var obj = data.objects[o.object_id];
  var resp = obj && data.users[obj.responsible_user_id];
  if (resp) out[resp.email] = true;
  else data.admins.forEach(function (a) { out[a.email] = true; });
  var extra = [];
  try { extra = o.extra_recipients ? JSON.parse(o.extra_recipients) : []; } catch (e) { extra = []; }
  extra.forEach(function (r) {
    if (r.userId && data.users[r.userId]) out[data.users[r.userId].email] = true;
    else if (r.email && !(r.email in out)) out[r.email] = false;
  });
  return out;
}

function alreadySent_(data, kind, period, recipient, refId) {
  return data.log.some(function (l) {
    return l.kind === kind && l.period === period && l.recipient === recipient && l.ref_id === (refId || '') && l.ok === 'true';
  });
}

/** Sends one e-mail and records it in MailLog (also when it fails). */
function sendMail_(orgId, kind, period, to, refId, msg, items) {
  var entry = { kind: kind, period: period, recipient: to, ref_id: refId || '', items: String(items || 0), sent_at: nowIso_() };
  var settings = kvAll_('Settings', orgId);
  try {
    MailApp.sendEmail({ to: to, subject: msg.subject, htmlBody: msg.html, body: msg.text, name: settings.mail_sender_name || 'Servisi' });
    entry.ok = 'true';
    entry.error = '';
  } catch (e) {
    entry.ok = 'false';
    entry.error = String(e.message || e);
  }
  var rec = t_('MailLog').insert(orgId, entry, 'mail');
  if (entry.ok !== 'true') throw new Error('E-mail to ' + to + ' failed: ' + entry.error);
  return rec;
}

// ------------------------------------------------------------------ monthly

function monthKey_(date) {
  return date.slice(0, 7);
}

function sendMonthly_(ctx, data) {
  var day = parseInt(data.settings.monthly_day || '1', 10);
  if (parseInt(ctx.today.slice(8, 10), 10) < day) return 0;
  var period = monthKey_(ctx.today);
  var perRecipient = {};
  var userEmails = {};
  Object.keys(data.users).forEach(function (id) { userEmails[data.users[id].email] = true; });
  // Every application user gets the monthly e-mail, even when empty (proof the system works).
  Object.keys(userEmails).forEach(function (e) { perRecipient[e] = []; });
  data.obligations.forEach(function (o) {
    if (!data.objects[o.object_id]) return;
    var cls = o.status === 'Incomplete' ? 'incomplete' : Schedule.classify(o.next_due, ctx.today);
    if (cls === 'later') return;
    var rec = recipientsOf_(o, data);
    Object.keys(rec).forEach(function (email) {
      (perRecipient[email] = perRecipient[email] || []).push({ o: o, cls: cls });
    });
  });
  var sent = 0;
  Object.keys(perRecipient).forEach(function (email) {
    var items = perRecipient[email];
    if (!userEmails[email] && !items.length) return;
    if (alreadySent_(data, 'Monthly', period, email, '')) return;
    var msg = monthlyMessage_(ctx, data, items, period, !userEmails[email]);
    sendMail_(ctx.orgId, 'Monthly', period, email, '', msg, items.length);
    sent++;
  });
  return sent;
}

// ------------------------------------------------------------------ warnings before due

function sendWarnings_(ctx, data) {
  var sent = 0;
  data.obligations.forEach(function (o) {
    if (!o.warn_days_before || !o.next_due || o.status !== 'Active' || !data.objects[o.object_id]) return;
    var warnOn = Schedule.addDays(o.next_due, -parseInt(o.warn_days_before, 10));
    if (ctx.today < warnOn || ctx.today > o.next_due) return;
    var rec = recipientsOf_(o, data);
    Object.keys(rec).forEach(function (email) {
      if (alreadySent_(data, 'Warning', o.next_due, email, o.id)) return;
      var msg = singleMessage_(ctx, data, o, 'Due on ' + fmtDate_(o.next_due), 'is due on ' + fmtDate_(o.next_due) + '.', !rec[email]);
      sendMail_(ctx.orgId, 'Warning', o.next_due, email, o.id, msg, 1);
      sent++;
    });
  });
  return sent;
}

// ------------------------------------------------------------------ snooze reminders

function sendReminders_(ctx, data) {
  var sent = 0;
  var oblById = {};
  t_('Obligations').list(ctx.orgId, { includeArchived: true }).forEach(function (o) { oblById[o.id] = o; });
  data.snoozes.forEach(function (s) {
    if (s.sent_at || s.cancelled_at || s.remind_on > ctx.today) return;
    var o = oblById[s.obligation_id];
    if (!o || o.archived_at) {
      t_('Snoozes').update(s.id, ctx.orgId, { cancelled_at: nowIso_(), cancelled_by: 'obligation archived' }, 'daily job');
      return;
    }
    var to = s.created_by;
    var note = s.note ? ' Your note: "' + s.note + '".' : '';
    var msg = singleMessage_(ctx, data, o, 'Reminder', 'reminder you asked for.' + note +
      (o.next_due ? ' Regular due date: ' + fmtDate_(o.next_due) + '.' : ''), false);
    sendMail_(ctx.orgId, 'Snooze', s.remind_on, to, s.id, msg, 1);
    t_('Snoozes').update(s.id, ctx.orgId, { sent_at: nowIso_() }, 'daily job');
    sent++;
  });
  return sent;
}

// ------------------------------------------------------------------ weekly overdue

function sendWeeklyOverdue_(ctx, data) {
  if (data.settings.weekly_overdue_reminder !== 'true') return 0;
  if (Schedule.weekday(ctx.today) !== 1) return 0;
  var per = {};
  data.obligations.forEach(function (o) {
    if (!data.objects[o.object_id] || o.status !== 'Active') return;
    if (Schedule.classify(o.next_due, ctx.today) !== 'overdue') return;
    var rec = recipientsOf_(o, data);
    Object.keys(rec).forEach(function (email) {
      if (!rec[email]) return; // external addresses only get the monthly list and warnings
      (per[email] = per[email] || []).push({ o: o, cls: 'overdue' });
    });
  });
  // The monthly e-mail of the same day already lists everything overdue.
  var monthlyToday = {};
  t_('MailLog').list(ctx.orgId).forEach(function (l) {
    if (l.kind === 'Monthly' && l.ok === 'true' && l.sent_at && Utilities.formatDate(new Date(l.sent_at), ctx.tz, 'yyyy-MM-dd') === ctx.today) {
      monthlyToday[l.recipient] = true;
    }
  });
  var sent = 0;
  Object.keys(per).forEach(function (email) {
    if (monthlyToday[email]) return;
    if (alreadySent_(data, 'WeeklyOverdue', ctx.today, email, '')) return;
    var msg = monthlyMessage_(ctx, data, per[email], ctx.today, false, true);
    sendMail_(ctx.orgId, 'WeeklyOverdue', ctx.today, email, '', msg, per[email].length);
    sent++;
  });
  return sent;
}

function notifyAdminsOfFailure_(ctx, errors) {
  var data = loadMailData_(ctx);
  data.admins.forEach(function (a) {
    try {
      MailApp.sendEmail({
        to: a.email,
        subject: 'Servisi: daily check failed',
        body: 'The daily check of ' + data.org.name + ' on ' + ctx.today + ' reported errors:\n\n' +
          errors.join('\n') + '\n\nOpen Settings > Status in the application.'
      });
    } catch (e) {
      console.error('Failure notice could not be sent: ' + e.message);
    }
  });
}
