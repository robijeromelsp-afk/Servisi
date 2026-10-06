/**
 * E-mail templates (HTML + plain text). Grouped by object, as agreed.
 * Language of the e-mails is the organisation setting language ('sl' default, 'en').
 * The same setting chooses the language of the application interface.
 */

var MAIL_TEXT = {
  sl: {
    disclaimer: 'Intervale vnašajo uporabniki. Aplikacija ne daje pravnih nasvetov in ne preverja zakonskih rokov.',
    overdue: 'Zamujeno',
    thisMonth: 'Zapade ta mesec',
    nextMonth: 'Zapade naslednji mesec',
    incomplete: 'Nepopolna nastavitev (roka ni mogoče izračunati)',
    monthlyTitle: 'Obveznosti za {m}/{y}',
    weeklyTitle: 'Zamujene obveznosti ({n})',
    nothing: 'Nič ni zamujeno in nič ne zapade ta ali naslednji mesec.',
    open: 'odpri',
    openApp: 'Odpri Servisi',
    openIn: 'Odpri v aplikaciji Servisi',
    typeMissing: '(vrsta manjka)',
    archivedObject: '(arhiviran objekt)',
    at: 'na objektu',
    contractor: 'Izvajalec',
    dueOnTitle: 'Rok {d}',
    dueOnSentence: 'rok je {d}.',
    reminderTitle: 'Opomnik',
    reminderSentence: 'opomnik, ki ste ga nastavili.',
    yourNote: ' Vaša opomba: "{n}".',
    regularDue: ' Redni rok: {d}.',
    failedSubject: 'Servisi: dnevno preverjanje ni uspelo',
    failedBody: 'Dnevno preverjanje za {org} dne {d} je javilo napake:\n\n{e}\n\nOdprite Settings > Status v aplikaciji.',
    testSubject: 'Servisi: testno sporočilo',
    testLine1: 'To je testno sporočilo aplikacije Servisi ({org}).',
    testLine2: 'Če ga berete, pošiljanje pošte deluje.'
  },
  en: {
    disclaimer: 'Intervals are entered by users. This application does not provide legal advice and does not verify statutory deadlines.',
    overdue: 'Overdue',
    thisMonth: 'Due this month',
    nextMonth: 'Due next month',
    incomplete: 'Incomplete setup (no due date can be computed)',
    monthlyTitle: 'Obligations for {m}/{y}',
    weeklyTitle: 'Overdue obligations ({n})',
    nothing: 'Nothing is overdue or due this month or next month.',
    open: 'open',
    openApp: 'Open Servisi',
    openIn: 'Open in Servisi',
    typeMissing: '(type missing)',
    archivedObject: '(archived object)',
    at: 'at',
    contractor: 'Contractor',
    dueOnTitle: 'Due on {d}',
    dueOnSentence: 'is due on {d}.',
    reminderTitle: 'Reminder',
    reminderSentence: 'reminder you asked for.',
    yourNote: ' Your note: "{n}".',
    regularDue: ' Regular due date: {d}.',
    failedSubject: 'Servisi: daily check failed',
    failedBody: 'The daily check of {org} on {d} reported errors:\n\n{e}\n\nOpen Settings > Status in the application.',
    testSubject: 'Servisi: test e-mail',
    testLine1: 'This is a test e-mail from Servisi ({org}).',
    testLine2: 'If you can read this, e-mail sending works.'
  }
};
var LANGUAGES = ['sl', 'en'];

/** Text in the organisation's e-mail language; {x} placeholders are filled from args. */
function tr_(settings, key, args) {
  var lang = MAIL_TEXT[settings && settings.language] ? settings.language : 'sl';
  var s = MAIL_TEXT[lang][key];
  Object.keys(args || {}).forEach(function (k) { s = s.split('{' + k + '}').join(String(args[k])); });
  return s;
}

var SECTIONS = [
  ['overdue', '#b42318'],
  ['thisMonth', '#b54708'],
  ['nextMonth', '#175cd3'],
  ['incomplete', '#6941c6']
];

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 2027-05-15 -> 15.05.2027 */
function fmtDate_(d) {
  return d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '';
}

function disclaimerHtml_(settings) {
  return '<p style="color:#667085;font-size:12px">' + esc_(tr_(settings, 'disclaimer')) + '</p>';
}

function mailFooter_(settings) {
  var link = settings.app_url ? '<p><a href="' + esc_(settings.app_url) + '">' + esc_(tr_(settings, 'openApp')) + '</a></p>' : '';
  return link + disclaimerHtml_(settings);
}

function obligationLink_(settings, o) {
  return settings.app_url ? settings.app_url.replace(/\/$/, '') + '/#/obligation/' + o.id : '';
}

function lineParts_(data, o) {
  var type = data.types[o.type_id];
  var contractor = data.contractors[o.contractor_id];
  return {
    type: type ? type.name : tr_(data.settings, 'typeMissing'),
    due: o.next_due ? fmtDate_(o.next_due) : '-',
    contractor: contractor ? contractor.name + (contractor.phone ? ', ' + contractor.phone : '') : '',
    note: o.note
  };
}

function objectTitle_(obj) {
  return obj.code + ' - ' + obj.name + (obj.address ? ', ' + obj.address : '');
}

/**
 * Monthly list (also used for the weekly overdue reminder).
 * items: [{ o, cls }]. external = recipient is not an application user (no links).
 */
function monthlyMessage_(ctx, data, items, period, external, weekly) {
  var settings = data.settings;
  var title = weekly
    ? tr_(settings, 'weeklyTitle', { n: items.length })
    : tr_(settings, 'monthlyTitle', { m: period.slice(5, 7), y: period.slice(0, 4) });
  var html = ['<div style="font-family:Arial,sans-serif;font-size:14px;color:#101828">',
    '<h2 style="margin:0 0 4px">' + esc_(title) + '</h2>',
    '<p style="margin:0 0 16px;color:#475467">' + esc_(data.org.name) + ' &middot; ' + fmtDate_(ctx.today) + '</p>'];
  var text = [title, data.org.name + ' - ' + fmtDate_(ctx.today), ''];

  if (!items.length) {
    html.push('<p>' + esc_(tr_(settings, 'nothing')) + '</p>');
    text.push(tr_(settings, 'nothing'));
  }
  SECTIONS.forEach(function (sec) {
    var inSec = items.filter(function (it) { return it.cls === sec[0]; });
    if (!inSec.length) return;
    var label = tr_(settings, sec[0]);
    html.push('<h3 style="color:' + sec[1] + ';margin:20px 0 6px">' + esc_(label) + ' (' + inSec.length + ')</h3>');
    text.push('== ' + label + ' (' + inSec.length + ') ==');
    var byObject = {};
    inSec.forEach(function (it) { (byObject[it.o.object_id] = byObject[it.o.object_id] || []).push(it.o); });
    Object.keys(byObject).sort(function (a, b) {
      return data.objects[a].code.localeCompare(data.objects[b].code);
    }).forEach(function (objId) {
      var obj = data.objects[objId];
      html.push('<p style="margin:10px 0 2px;font-weight:bold">' + esc_(objectTitle_(obj)) + '</p><ul style="margin:0;padding-left:20px">');
      text.push(objectTitle_(obj));
      byObject[objId].sort(function (a, b) { return (a.next_due || '').localeCompare(b.next_due || ''); }).forEach(function (o) {
        var p = lineParts_(data, o);
        var link = external ? '' : obligationLink_(settings, o);
        var lineLabel = esc_(p.type) + (link ? ' <a href="' + esc_(link) + '">' + esc_(tr_(settings, 'open')) + '</a>' : '');
        html.push('<li style="margin:2px 0">' + (sec[0] === 'incomplete' ? '' : '<b>' + p.due + '</b> &middot; ') + lineLabel +
          (p.contractor ? ' &middot; ' + esc_(p.contractor) : '') + (p.note ? '<br><span style="color:#475467">' + esc_(p.note) + '</span>' : '') + '</li>');
        text.push('  - ' + (sec[0] === 'incomplete' ? '' : p.due + '  ') + p.type + (p.contractor ? '  (' + p.contractor + ')' : '') +
          (link ? '  ' + link : ''));
      });
      html.push('</ul>');
    });
    text.push('');
  });
  html.push(external ? disclaimerHtml_(settings) : mailFooter_(settings));
  html.push('</div>');
  text.push(tr_(settings, 'disclaimer'));
  return {
    subject: 'Servisi: ' + title + ' - ' + data.org.name,
    html: html.join('\n'),
    text: text.join('\n')
  };
}

/** Short e-mail about one obligation (warning before due, snooze reminder). */
function singleMessage_(ctx, data, o, title, sentence, external) {
  var settings = data.settings;
  var obj = data.objects[o.object_id] || { code: '?', name: tr_(settings, 'archivedObject'), address: '' };
  var p = lineParts_(data, o);
  var link = external ? '' : obligationLink_(settings, o);
  var at = tr_(settings, 'at');
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#101828">' +
    '<h2 style="margin:0 0 8px">' + esc_(title) + '</h2>' +
    '<p><b>' + esc_(p.type) + '</b> ' + esc_(at) + ' <b>' + esc_(objectTitle_(obj)) + '</b>: ' + esc_(sentence) + '</p>' +
    (p.contractor ? '<p>' + esc_(tr_(settings, 'contractor')) + ': ' + esc_(p.contractor) + '</p>' : '') +
    (link ? '<p><a href="' + esc_(link) + '">' + esc_(tr_(settings, 'openIn')) + '</a></p>' : '') +
    disclaimerHtml_(settings) + '</div>';
  var text = title + '\n\n' + p.type + ' ' + at + ' ' + objectTitle_(obj) + ': ' + sentence + '\n' +
    (p.contractor ? tr_(settings, 'contractor') + ': ' + p.contractor + '\n' : '') + (link ? link + '\n' : '') +
    '\n' + tr_(settings, 'disclaimer');
  return { subject: 'Servisi: ' + title + ' - ' + p.type + ' - ' + obj.code, html: html, text: text };
}
