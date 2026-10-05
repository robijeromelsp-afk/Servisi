/**
 * E-mail templates (HTML + plain text). Grouped by object, as agreed.
 */

var DISCLAIMER = 'Intervals are entered by users. This application does not provide legal advice ' +
  'and does not verify statutory deadlines.';

var SECTIONS = [
  ['overdue', 'Overdue', '#b42318'],
  ['thisMonth', 'Due this month', '#b54708'],
  ['nextMonth', 'Due next month', '#175cd3'],
  ['incomplete', 'Incomplete setup (no due date can be computed)', '#6941c6']
];

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 2027-05-15 -> 15.05.2027 */
function fmtDate_(d) {
  return d ? d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4) : '';
}

function mailFooter_(settings) {
  var link = settings.app_url ? '<p><a href="' + esc_(settings.app_url) + '">Open Servisi</a></p>' : '';
  return link + '<p style="color:#667085;font-size:12px">' + esc_(DISCLAIMER) + '</p>';
}

function obligationLink_(settings, o) {
  return settings.app_url ? settings.app_url.replace(/\/$/, '') + '/#/obligation/' + o.id : '';
}

function lineParts_(data, o) {
  var type = data.types[o.type_id];
  var contractor = data.contractors[o.contractor_id];
  return {
    type: type ? type.name : '(type missing)',
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
    ? 'Overdue obligations (' + items.length + ')'
    : 'Obligations for ' + period.slice(5, 7) + '/' + period.slice(0, 4);
  var html = ['<div style="font-family:Arial,sans-serif;font-size:14px;color:#101828">',
    '<h2 style="margin:0 0 4px">' + esc_(title) + '</h2>',
    '<p style="margin:0 0 16px;color:#475467">' + esc_(data.org.name) + ' &middot; ' + fmtDate_(ctx.today) + '</p>'];
  var text = [title, data.org.name + ' - ' + fmtDate_(ctx.today), ''];

  if (!items.length) {
    html.push('<p>Nothing is overdue or due this month or next month.</p>');
    text.push('Nothing is overdue or due this month or next month.');
  }
  SECTIONS.forEach(function (sec) {
    var inSec = items.filter(function (it) { return it.cls === sec[0]; });
    if (!inSec.length) return;
    html.push('<h3 style="color:' + sec[2] + ';margin:20px 0 6px">' + esc_(sec[1]) + ' (' + inSec.length + ')</h3>');
    text.push('== ' + sec[1] + ' (' + inSec.length + ') ==');
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
        var label = esc_(p.type) + (link ? ' <a href="' + esc_(link) + '">open</a>' : '');
        html.push('<li style="margin:2px 0">' + (sec[0] === 'incomplete' ? '' : '<b>' + p.due + '</b> &middot; ') + label +
          (p.contractor ? ' &middot; ' + esc_(p.contractor) : '') + (p.note ? '<br><span style="color:#475467">' + esc_(p.note) + '</span>' : '') + '</li>');
        text.push('  - ' + (sec[0] === 'incomplete' ? '' : p.due + '  ') + p.type + (p.contractor ? '  (' + p.contractor + ')' : '') +
          (link ? '  ' + link : ''));
      });
      html.push('</ul>');
    });
    text.push('');
  });
  html.push(external ? '<p style="color:#667085;font-size:12px">' + esc_(DISCLAIMER) + '</p>' : mailFooter_(settings));
  html.push('</div>');
  text.push(DISCLAIMER);
  return {
    subject: 'Servisi: ' + title + ' - ' + data.org.name,
    html: html.join('\n'),
    text: text.join('\n')
  };
}

/** Short e-mail about one obligation (warning before due, snooze reminder). */
function singleMessage_(ctx, data, o, title, sentence, external) {
  var settings = data.settings;
  var obj = data.objects[o.object_id] || { code: '?', name: '(archived object)', address: '' };
  var p = lineParts_(data, o);
  var link = external ? '' : obligationLink_(settings, o);
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#101828">' +
    '<h2 style="margin:0 0 8px">' + esc_(title) + '</h2>' +
    '<p><b>' + esc_(p.type) + '</b> at <b>' + esc_(objectTitle_(obj)) + '</b>: ' + esc_(sentence) + '</p>' +
    (p.contractor ? '<p>Contractor: ' + esc_(p.contractor) + '</p>' : '') +
    (link ? '<p><a href="' + esc_(link) + '">Open in Servisi</a></p>' : '') +
    '<p style="color:#667085;font-size:12px">' + esc_(DISCLAIMER) + '</p></div>';
  var text = title + '\n\n' + p.type + ' at ' + objectTitle_(obj) + ': ' + sentence + '\n' +
    (p.contractor ? 'Contractor: ' + p.contractor + '\n' : '') + (link ? link + '\n' : '') + '\n' + DISCLAIMER;
  return { subject: 'Servisi: ' + title + ' - ' + p.type + ' - ' + obj.code, html: html, text: text };
}
