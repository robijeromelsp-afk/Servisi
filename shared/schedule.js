/**
 * Schedule engine: computes due dates of a recurring obligation.
 *
 * One pure module, used unchanged by the Apps Script backend, the browser
 * frontend and the Node tests. No I/O, no clock: "today" is always passed in.
 *
 * All dates are calendar dates as strings 'YYYY-MM-DD' (no time, no time zone).
 * Internally a date is a day number (days since 1970-01-01, UTC arithmetic),
 * so daylight saving time can never move a due date.
 *
 * Rule types (model taken from the maintenance base of the heating plant):
 *   dan         every day
 *   teden       weekday            1 = Monday ... 7 = Sunday
 *   n_dni       interval           every N days, counted from start
 *   mesec       day                day of month 1-28
 *   cetrtletje  day + months       day of month 1-28 in the listed months
 *   polletje    day + months       day of month 1-28 in the listed months
 *   leto        day + month
 *   vec_let     day + month + interval (years), counted from the year of start
 *
 * countFrom:
 *   'completion'  next due = completion date + interval of the rule
 *   'calendar'    next due = first calendar date of the rule strictly after
 *                 max(due date being closed, completion date). Calendar dates
 *                 in between are reported as skipped (decision "b1").
 *
 * start: the first due date is on or after this date.
 * lastDoneBeforeApp: completion that happened before the obligation was
 *   entered; replaces start as the origin of the first due date.
 */
var Schedule = (function () {
  'use strict';

  var TYPES = ['dan', 'teden', 'n_dni', 'mesec', 'cetrtletje', 'polletje', 'leto', 'vec_let'];
  var COUNT_FROM = ['completion', 'calendar'];
  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  var WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Safety limit for any forward search; a valid rule always finds a date far sooner.
  var MAX_MONTH_STEPS = 12 * 200;

  // ---------------------------------------------------------------- dates

  var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

  function isDate(s) {
    if (typeof s !== 'string') return false;
    var m = DATE_RE.exec(s);
    if (!m) return false;
    var y = +m[1], mo = +m[2], d = +m[3];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
  }

  function parse(s) {
    if (!isDate(s)) throw new Error('Invalid date: ' + s);
    var m = DATE_RE.exec(s);
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function dayNum(s) {
    var p = parse(s);
    return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
  }

  function fromDayNum(n) {
    var dt = new Date(n * 86400000);
    return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  function fmt(y, m, d) {
    return String(y).padStart(4, '0') + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function addDays(s, n) {
    return fromDayNum(dayNum(s) + n);
  }

  /** Adds calendar months; a day missing in the target month becomes its last day. */
  function addMonths(s, n) {
    var p = parse(s);
    var idx = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(idx / 12), m = idx % 12 + 1;
    return fmt(y, m, Math.min(p.d, daysInMonth(y, m)));
  }

  /** ISO weekday, 1 = Monday ... 7 = Sunday. */
  function weekday(s) {
    var wd = new Date(dayNum(s) * 86400000).getUTCDay();
    return wd === 0 ? 7 : wd;
  }

  function cmp(a, b) {
    return a < b ? -1 : a > b ? 1 : 0; // ISO strings sort chronologically
  }

  function maxDate(a, b) {
    return cmp(a, b) >= 0 ? a : b;
  }

  // ---------------------------------------------------------------- rules

  function toInt(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isInteger(n) ? n : NaN;
  }

  function toMonths(v) {
    if (v === null || v === undefined || v === '') return [];
    var list = Array.isArray(v) ? v : String(v).split(/[,;\s]+/).filter(Boolean);
    return list.map(toInt);
  }

  /** Normalises a rule as stored (strings from a sheet) into typed values. */
  function normalize(raw) {
    raw = raw || {};
    var months = toMonths(raw.months);
    var uniq = [];
    months.forEach(function (m) { if (uniq.indexOf(m) < 0) uniq.push(m); });
    uniq.sort(function (a, b) { return a - b; });
    return {
      type: raw.type ? String(raw.type) : '',
      weekday: toInt(raw.weekday),
      interval: toInt(raw.interval),
      day: toInt(raw.day),
      months: uniq,
      month: toInt(raw.month),
      start: raw.start ? String(raw.start) : '',
      countFrom: raw.countFrom ? String(raw.countFrom) : '',
      lastDoneBeforeApp: raw.lastDoneBeforeApp ? String(raw.lastDoneBeforeApp) : ''
    };
  }

  function between(n, lo, hi) {
    return Number.isInteger(n) && n >= lo && n <= hi;
  }

  /** Returns a list of human-readable problems; empty list = complete rule. */
  function validate(raw) {
    var r = normalize(raw);
    var e = [];
    if (TYPES.indexOf(r.type) < 0) e.push('Repeat type is missing or unknown.');
    if (COUNT_FROM.indexOf(r.countFrom) < 0) e.push('Choose whether to count from completion or by calendar.');
    if (r.start && !isDate(r.start)) e.push('Start date is not a valid date.');
    if (r.lastDoneBeforeApp && !isDate(r.lastDoneBeforeApp)) e.push('Last done date is not a valid date.');
    if (!r.start && !r.lastDoneBeforeApp) e.push('Enter a start date or the date it was last done.');
    var cal = r.countFrom === 'calendar';
    switch (r.type) {
      case 'teden':
        if (cal && !between(r.weekday, 1, 7)) e.push('Weekday must be 1 (Monday) to 7 (Sunday).');
        break;
      case 'n_dni':
        if (!between(r.interval, 1, 3650)) e.push('Interval must be 1 to 3650 days.');
        if (cal && !r.start) e.push('Calendar counting every N days needs a start date.');
        break;
      case 'mesec':
        if (cal && !between(r.day, 1, 28)) e.push('Day of month must be 1 to 28.');
        break;
      case 'cetrtletje':
      case 'polletje':
        if (cal && !between(r.day, 1, 28)) e.push('Day of month must be 1 to 28.');
        if (cal && (r.months.length === 0 || r.months.some(function (m) { return !between(m, 1, 12); }))) {
          e.push('List the months (1 to 12).');
        }
        break;
      case 'leto':
        if (cal && !between(r.day, 1, 28)) e.push('Day of month must be 1 to 28.');
        if (cal && !between(r.month, 1, 12)) e.push('Month must be 1 to 12.');
        break;
      case 'vec_let':
        if (!between(r.interval, 1, 100)) e.push('Interval must be 1 to 100 years.');
        if (cal && !between(r.day, 1, 28)) e.push('Day of month must be 1 to 28.');
        if (cal && !between(r.month, 1, 12)) e.push('Month must be 1 to 12.');
        if (cal && !r.start) e.push('Calendar counting over several years needs a start date.');
        break;
    }
    return e;
  }

  // ------------------------------------------------- interval (completion)

  function addInterval(r, s) {
    switch (r.type) {
      case 'dan': return addDays(s, 1);
      case 'teden': return addDays(s, 7);
      case 'n_dni': return addDays(s, r.interval);
      case 'mesec': return addMonths(s, 1);
      case 'cetrtletje': return addMonths(s, 3);
      case 'polletje': return addMonths(s, 6);
      case 'leto': return addMonths(s, 12);
      case 'vec_let': return addMonths(s, 12 * r.interval);
    }
    throw new Error('Unknown type: ' + r.type);
  }

  // ---------------------------------------------------- calendar grid

  /** True when month m of year y carries a due date under rule r. */
  function monthMatches(r, y, m) {
    switch (r.type) {
      case 'mesec': return true;
      case 'cetrtletje':
      case 'polletje': return r.months.indexOf(m) >= 0;
      case 'leto': return m === r.month;
      case 'vec_let':
        return m === r.month && (y - parse(r.start).y) % r.interval === 0 && y >= parse(r.start).y;
    }
    return false;
  }

  /** First calendar due date of rule r that is > s (strict) or >= s. */
  function gridAfter(r, s, strict) {
    var n = dayNum(s);
    switch (r.type) {
      case 'dan':
        return strict ? addDays(s, 1) : s;
      case 'teden': {
        var diff = (r.weekday - weekday(s) + 7) % 7;
        if (diff === 0 && strict) diff = 7;
        return addDays(s, diff);
      }
      case 'n_dni': {
        var base = dayNum(r.start);
        if (n < base || (n === base && !strict)) return r.start;
        var k = Math.floor((n - base) / r.interval);
        var cand = base + k * r.interval;
        if (cand < n || (cand === n && strict)) cand += r.interval;
        return fromDayNum(cand);
      }
    }
    var p = parse(s);
    for (var i = 0; i <= MAX_MONTH_STEPS; i++) {
      var idx = p.y * 12 + (p.m - 1) + i;
      var y = Math.floor(idx / 12), m = idx % 12 + 1;
      if (!monthMatches(r, y, m)) continue;
      var c = fmt(y, m, r.day);
      var c0 = cmp(c, s);
      if (c0 > 0 || (c0 === 0 && !strict)) return c;
    }
    throw new Error('No calendar date found for rule.');
  }

  // ---------------------------------------------------------- compute

  function firstDue(r) {
    if (r.countFrom === 'completion') {
      return r.lastDoneBeforeApp ? addInterval(r, r.lastDoneBeforeApp) : r.start;
    }
    if (r.lastDoneBeforeApp) {
      var after = gridAfter(r, r.lastDoneBeforeApp, true);
      // A start date later than the last completion still bounds the first due date.
      return r.start ? maxDate(after, gridAfter(r, r.start, false)) : after;
    }
    return gridAfter(r, r.start, false);
  }

  function nextAfterCompletion(r, due, done) {
    if (r.countFrom === 'completion') return { next: addInterval(r, done), skipped: [] };
    var until = maxDate(due, done);
    var skipped = [];
    var g = gridAfter(r, due, true);
    while (cmp(g, until) <= 0) {
      skipped.push(g);
      g = gridAfter(r, g, true);
    }
    return { next: g, skipped: skipped };
  }

  /**
   * Replays the history of an obligation.
   *
   * @param raw          rule (see normalize)
   * @param completions  [{ id, doneDate, order? }] valid (not voided) completions;
   *                     order (e.g. created timestamp) breaks ties on equal dates.
   * @return { complete, errors, nextDue, history }
   *   history: chronological list of
   *     { kind: 'done', due, doneDate, late, id }   a completion and the due it closed
   *     { kind: 'skipped', due }                     calendar due passed over (b1)
   */
  function compute(raw, completions) {
    var errors = validate(raw);
    if (errors.length) return { complete: false, errors: errors, nextDue: null, history: [] };
    var r = normalize(raw);
    var list = (completions || []).slice().filter(function (c) { return isDate(c.doneDate); });
    list.sort(function (a, b) {
      return cmp(a.doneDate, b.doneDate) || cmp(String(a.order || ''), String(b.order || ''));
    });
    var due = firstDue(r);
    var history = [];
    list.forEach(function (c) {
      history.push({ kind: 'done', due: due, doneDate: c.doneDate, late: cmp(c.doneDate, due) > 0, id: c.id });
      var step = nextAfterCompletion(r, due, c.doneDate);
      step.skipped.forEach(function (s) { history.push({ kind: 'skipped', due: s }); });
      due = step.next;
    });
    return { complete: true, errors: [], nextDue: due, history: history };
  }

  /**
   * Due dates that follow nextDue if every one is done exactly on time.
   * Used for the preview "next 5 due dates".
   */
  function upcoming(raw, nextDue, count) {
    var r = normalize(raw);
    var out = [];
    var d = nextDue;
    for (var i = 0; i < count && d; i++) {
      out.push(d);
      d = r.countFrom === 'completion' ? addInterval(r, d) : gridAfter(r, d, true);
    }
    return out;
  }

  /** 'overdue' | 'thisMonth' | 'nextMonth' | 'later' for a due date seen on day today. */
  function classify(nextDue, today) {
    if (!nextDue) return 'incomplete';
    if (cmp(nextDue, today) < 0) return 'overdue';
    var t = parse(today);
    var monthStart = fmt(t.y, t.m, 1);
    var nextMonthStart = addMonths(monthStart, 1);
    var afterNext = addMonths(monthStart, 2);
    if (cmp(nextDue, nextMonthStart) < 0) return 'thisMonth';
    if (cmp(nextDue, afterNext) < 0) return 'nextMonth';
    return 'later';
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /** Short English description of a rule, e.g. "Every year on 15 May, by calendar". */
  function describe(raw) {
    var r = normalize(raw);
    var base;
    switch (r.type) {
      case 'dan': base = 'Every day'; break;
      case 'teden': base = r.countFrom === 'calendar' && r.weekday ? 'Every ' + WEEKDAY_NAMES[r.weekday - 1] : 'Every week'; break;
      case 'n_dni': base = 'Every ' + r.interval + ' days'; break;
      case 'mesec': base = r.countFrom === 'calendar' ? 'Every month on the ' + ordinal(r.day) : 'Every month'; break;
      case 'cetrtletje':
      case 'polletje':
        base = (r.type === 'cetrtletje' ? 'Quarterly' : 'Half-yearly') + (r.countFrom === 'calendar'
          ? ' on the ' + ordinal(r.day) + ' of ' + r.months.map(function (m) { return MONTH_NAMES[m - 1].slice(0, 3); }).join(', ')
          : '');
        break;
      case 'leto': base = r.countFrom === 'calendar' ? 'Every year on ' + r.day + ' ' + MONTH_NAMES[r.month - 1] : 'Every year'; break;
      case 'vec_let': base = 'Every ' + r.interval + ' years' + (r.countFrom === 'calendar' ? ' on ' + r.day + ' ' + MONTH_NAMES[r.month - 1] : ''); break;
      default: return 'Repeat not set';
    }
    return base + (r.countFrom === 'calendar' ? ', by calendar' : ', counted from last completion');
  }

  return {
    TYPES: TYPES,
    COUNT_FROM: COUNT_FROM,
    isDate: isDate,
    addDays: addDays,
    addMonths: addMonths,
    weekday: weekday,
    normalize: normalize,
    validate: validate,
    compute: compute,
    upcoming: upcoming,
    classify: classify,
    describe: describe
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Schedule;
