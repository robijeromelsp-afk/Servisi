'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../shared/schedule.js');

const done = (...dates) => dates.map((d, i) => ({ id: 'c' + i, doneDate: d }));
const next = (rule, completions = []) => S.compute(rule, completions).nextDue;

// ------------------------------------------------------------ date helpers

test('date helpers', () => {
  assert.equal(S.isDate('2028-02-29'), true);
  assert.equal(S.isDate('2027-02-29'), false);
  assert.equal(S.isDate('2027-13-01'), false);
  assert.equal(S.isDate('2027-1-01'), false);
  assert.equal(S.addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(S.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(S.addMonths('2028-02-29', 12), '2029-02-28');
  assert.equal(S.addMonths('2027-11-15', 3), '2028-02-15');
  assert.equal(S.addDays('2027-12-31', 1), '2028-01-01');
  assert.equal(S.addDays('2027-03-27', 2), '2027-03-29'); // over DST change
  assert.equal(S.weekday('2026-10-05'), 1); // Monday
  assert.equal(S.weekday('2026-10-11'), 7); // Sunday
});

// ------------------------------------------------------------ validation

test('incomplete rules are reported, never computed', () => {
  const r = S.compute({ type: 'leto', countFrom: 'calendar', day: 15 }, []);
  assert.equal(r.complete, false);
  assert.equal(r.nextDue, null);
  assert.ok(r.errors.some((e) => /Month/.test(e)));
  assert.ok(r.errors.some((e) => /start date/.test(e)));
  assert.ok(S.validate({}).length >= 3);
  assert.deepEqual(S.validate({ type: 'mesec', countFrom: 'calendar', day: 29, start: '2027-01-01' }),
    ['Day of month must be 1 to 28.']);
  assert.deepEqual(S.validate({ type: 'n_dni', countFrom: 'completion', interval: 0, start: '2027-01-01' }),
    ['Interval must be 1 to 3650 days.']);
  assert.deepEqual(S.validate({ type: 'cetrtletje', countFrom: 'calendar', day: 1, months: '', start: '2027-01-01' }),
    ['List the months (1 to 12).']);
  assert.deepEqual(S.validate({ type: 'leto', countFrom: 'completion', start: '2027-02-30' }),
    ['Start date is not a valid date.']);
  assert.equal(S.classify(null, '2027-01-01'), 'incomplete');
});

test('values as stored in a sheet (strings) are accepted', () => {
  const rule = { type: 'cetrtletje', countFrom: 'calendar', day: '10', months: '10, 1,4;7', start: '2027-02-01' };
  assert.deepEqual(S.validate(rule), []);
  assert.equal(next(rule), '2027-04-10');
});

// ------------------------------------------------------------ calendar mode

test('leto, calendar: first due on or after start', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-05-15' };
  assert.equal(next(rule), '2027-05-15');
  assert.equal(next({ ...rule, start: '2027-05-16' }), '2028-05-15');
});

test('leto, calendar, b1: late completion keeps the calendar', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-01-01' };
  const r = S.compute(rule, done('2027-08-10'));
  assert.equal(r.nextDue, '2028-05-15');
  assert.deepEqual(r.history, [{ kind: 'done', due: '2027-05-15', doneDate: '2027-08-10', late: true, id: 'c0' }]);
});

test('leto, calendar, b1: more than a period late skips the missed due', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-01-01' };
  const r = S.compute(rule, done('2028-06-01'));
  assert.equal(r.nextDue, '2029-05-15');
  assert.deepEqual(r.history.map((h) => h.kind + ':' + h.due), ['done:2027-05-15', 'skipped:2028-05-15']);
});

test('calendar, b1: several missed dues are all reported as skipped', () => {
  const rule = { type: 'mesec', countFrom: 'calendar', day: 5, start: '2027-01-01' };
  const r = S.compute(rule, done('2027-04-20'));
  assert.equal(r.nextDue, '2027-05-05');
  assert.deepEqual(r.history.filter((h) => h.kind === 'skipped').map((h) => h.due),
    ['2027-02-05', '2027-03-05', '2027-04-05']);
});

test('calendar: completion exactly on a later due date counts that date as skipped', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-01-01' };
  const r = S.compute(rule, done('2028-05-15'));
  assert.equal(r.nextDue, '2029-05-15');
  assert.deepEqual(r.history.filter((h) => h.kind === 'skipped').map((h) => h.due), ['2028-05-15']);
});

test('calendar: early completion closes the current due', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-01-01' };
  const r = S.compute(rule, done('2027-03-01'));
  assert.equal(r.nextDue, '2028-05-15');
  assert.equal(r.history[0].late, false);
  assert.equal(r.history[0].due, '2027-05-15');
});

test('calendar: on-time completion is not late', () => {
  const rule = { type: 'mesec', countFrom: 'calendar', day: 10, start: '2027-01-01' };
  const r = S.compute(rule, done('2027-01-10', '2027-02-09'));
  assert.equal(r.nextDue, '2027-03-10');
  assert.deepEqual(r.history.map((h) => h.late), [false, false]);
});

test('cetrtletje and polletje, calendar', () => {
  const q = { type: 'cetrtletje', countFrom: 'calendar', day: 1, months: [1, 4, 7, 10], start: '2027-04-02' };
  assert.equal(next(q), '2027-07-01');
  assert.equal(next(q, done('2027-07-01')), '2027-10-01');
  assert.equal(next(q, done('2027-07-01', '2027-10-15')), '2028-01-01');
  const h = { type: 'polletje', countFrom: 'calendar', day: 20, months: [3, 9], start: '2027-09-21' };
  assert.equal(next(h), '2028-03-20');
  assert.equal(next(h, done('2028-03-01')), '2028-09-20');
});

test('vec_let, calendar: interval counted from the start year', () => {
  const rule = { type: 'vec_let', countFrom: 'calendar', day: 1, month: 6, interval: 5, start: '2027-01-01' };
  assert.equal(next(rule), '2027-06-01');
  assert.equal(next(rule, done('2027-06-01')), '2032-06-01');
  const r = S.compute(rule, done('2033-01-10'));
  assert.equal(r.nextDue, '2037-06-01');
  assert.deepEqual(r.history.filter((h) => h.kind === 'skipped').map((h) => h.due), ['2032-06-01']);
  // start after June: first due is the first matching year on or after start
  assert.equal(next({ ...rule, start: '2027-07-01' }), '2032-06-01');
});

test('teden, calendar', () => {
  const rule = { type: 'teden', countFrom: 'calendar', weekday: 3, start: '2026-10-05' }; // Monday
  assert.equal(next(rule), '2026-10-07'); // Wednesday
  assert.equal(next({ ...rule, start: '2026-10-07' }), '2026-10-07');
  assert.equal(next(rule, done('2026-10-07')), '2026-10-14');
  assert.equal(next(rule, done('2026-10-20')), '2026-10-21'); // two Wednesdays skipped
});

test('n_dni, calendar: fixed grid from start', () => {
  const rule = { type: 'n_dni', countFrom: 'calendar', interval: 14, start: '2027-01-01' };
  assert.equal(next(rule), '2027-01-01');
  assert.equal(next(rule, done('2027-01-03')), '2027-01-15');
  assert.equal(next(rule, done('2027-01-03', '2027-01-30')), '2027-02-12');
});

test('dan, calendar', () => {
  const rule = { type: 'dan', countFrom: 'calendar', start: '2027-01-01' };
  assert.equal(next(rule), '2027-01-01');
  assert.equal(next(rule, done('2027-01-01')), '2027-01-02');
  assert.equal(next(rule, done('2027-01-04')), '2027-01-05');
});

test('calendar: last done before the app', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, lastDoneBeforeApp: '2026-06-01' };
  assert.equal(next(rule), '2027-05-15');
  // a later start still bounds the first due date
  assert.equal(next({ ...rule, start: '2027-06-01' }), '2028-05-15');
});

// ------------------------------------------------------------ completion mode

test('completion mode: delay shifts all later dues', () => {
  const rule = { type: 'leto', countFrom: 'completion', start: '2027-05-15' };
  assert.equal(next(rule), '2027-05-15');
  const r = S.compute(rule, done('2027-08-10'));
  assert.equal(r.nextDue, '2028-08-10');
  assert.equal(r.history[0].late, true);
  assert.equal(next(rule, done('2027-08-10', '2028-08-01')), '2029-08-01');
});

test('completion mode: intervals of every type', () => {
  const base = { countFrom: 'completion', start: '2027-01-31' };
  const c = done('2027-01-31');
  assert.equal(next({ ...base, type: 'dan' }, c), '2027-02-01');
  assert.equal(next({ ...base, type: 'teden' }, c), '2027-02-07');
  assert.equal(next({ ...base, type: 'n_dni', interval: 10 }, c), '2027-02-10');
  assert.equal(next({ ...base, type: 'mesec' }, c), '2027-02-28'); // end of month clamp
  assert.equal(next({ ...base, type: 'cetrtletje' }, c), '2027-04-30');
  assert.equal(next({ ...base, type: 'polletje' }, c), '2027-07-31');
  assert.equal(next({ ...base, type: 'leto' }, c), '2028-01-31');
  assert.equal(next({ ...base, type: 'vec_let', interval: 12 }, c), '2039-01-31');
});

test('completion mode: leap day', () => {
  const rule = { type: 'leto', countFrom: 'completion', start: '2028-02-29' };
  assert.equal(next(rule, done('2028-02-29')), '2029-02-28');
});

test('completion mode: last done before the app', () => {
  const rule = { type: 'vec_let', countFrom: 'completion', interval: 5, lastDoneBeforeApp: '2024-09-01' };
  assert.equal(next(rule), '2029-09-01');
});

// ------------------------------------------------------------ history replay

test('replay is independent of input order; ties use order', () => {
  const rule = { type: 'mesec', countFrom: 'calendar', day: 1, start: '2027-01-01' };
  const a = S.compute(rule, [{ id: 'b', doneDate: '2027-02-01' }, { id: 'a', doneDate: '2027-01-01' }]);
  assert.equal(a.nextDue, '2027-03-01');
  assert.deepEqual(a.history.map((h) => h.id), ['a', 'b']);
  const t = S.compute(rule, [{ id: 'y', doneDate: '2027-01-01', order: '2' }, { id: 'x', doneDate: '2027-01-01', order: '1' }]);
  assert.deepEqual(t.history.map((h) => h.id + ':' + h.due), ['x:2027-01-01', 'y:2027-02-01']);
});

test('voiding a completion (removing it from the list) restores the earlier due', () => {
  const rule = { type: 'leto', countFrom: 'calendar', day: 15, month: 5, start: '2027-01-01' };
  assert.equal(next(rule, done('2027-05-10')), '2028-05-15');
  assert.equal(next(rule, []), '2027-05-15');
});

// ------------------------------------------------------------ preview, classify, describe

test('upcoming due dates', () => {
  const rule = { type: 'cetrtletje', countFrom: 'calendar', day: 1, months: [1, 4, 7, 10], start: '2027-01-01' };
  assert.deepEqual(S.upcoming(rule, '2027-10-01', 3), ['2027-10-01', '2028-01-01', '2028-04-01']);
  const c = { type: 'mesec', countFrom: 'completion', start: '2027-01-31' };
  assert.deepEqual(S.upcoming(c, '2027-01-31', 3), ['2027-01-31', '2027-02-28', '2027-03-28']);
});

test('classify against today', () => {
  const today = '2027-11-01';
  assert.equal(S.classify('2027-10-31', today), 'overdue');
  assert.equal(S.classify('2027-11-01', today), 'thisMonth');
  assert.equal(S.classify('2027-11-30', today), 'thisMonth');
  assert.equal(S.classify('2027-12-01', today), 'nextMonth');
  assert.equal(S.classify('2027-12-31', today), 'nextMonth');
  assert.equal(S.classify('2028-01-01', today), 'later');
  assert.equal(S.classify('2028-01-05', '2027-12-15'), 'nextMonth'); // over year end
});

test('describe', () => {
  assert.equal(S.describe({ type: 'leto', countFrom: 'calendar', day: 15, month: 5 }), 'Every year on 15 May, by calendar');
  assert.equal(S.describe({ type: 'mesec', countFrom: 'calendar', day: 1 }), 'Every month on the 1st, by calendar');
  assert.equal(S.describe({ type: 'cetrtletje', countFrom: 'calendar', day: 22, months: '1,4,7,10' }),
    'Quarterly on the 22nd of Jan, Apr, Jul, Oct, by calendar');
  assert.equal(S.describe({ type: 'vec_let', countFrom: 'completion', interval: 5 }), 'Every 5 years, counted from last completion');
  assert.equal(S.describe({}), 'Repeat not set');
});

// ------------------------------------------------------------ exhaustive cross-check

test('calendar mode: next due is always after max(due, done) and on the grid', () => {
  const rules = [
    { type: 'dan', countFrom: 'calendar', start: '2027-01-01' },
    { type: 'teden', countFrom: 'calendar', weekday: 5, start: '2027-01-01' },
    { type: 'n_dni', countFrom: 'calendar', interval: 9, start: '2027-01-03' },
    { type: 'mesec', countFrom: 'calendar', day: 28, start: '2027-01-01' },
    { type: 'cetrtletje', countFrom: 'calendar', day: 15, months: [2, 5, 8, 11], start: '2027-01-01' },
    { type: 'polletje', countFrom: 'calendar', day: 1, months: [6, 12], start: '2027-01-01' },
    { type: 'leto', countFrom: 'calendar', day: 28, month: 2, start: '2027-01-01' },
    { type: 'vec_let', countFrom: 'calendar', day: 1, month: 3, interval: 2, start: '2027-01-01' }
  ];
  for (const rule of rules) {
    const grid = new Set(S.upcoming(rule, next(rule), 400));
    let completions = [];
    let doneDate = '2027-01-01';
    for (let i = 0; i < 40; i++) {
      doneDate = S.addDays(doneDate, (i * 37) % 200);
      completions = completions.concat([{ id: 'c' + i, doneDate }]);
      const r = S.compute(rule, completions);
      const last = r.history.filter((h) => h.kind === 'done').pop();
      assert.ok(r.nextDue > doneDate && r.nextDue > last.due, rule.type + ' ' + doneDate);
      assert.ok(grid.has(r.nextDue) || r.nextDue > [...grid].pop(), rule.type + ' off grid ' + r.nextDue);
      const dues = r.history.map((h) => h.due);
      assert.deepEqual(dues, [...dues].sort(), rule.type + ' history order');
    }
  }
});

test('Slovenian descriptions and messages', () => {
  assert.equal(S.describe({ type: 'leto', countFrom: 'calendar', day: 15, month: 5 }, 'sl'), 'Vsako leto, 15. maja, po koledarju');
  assert.equal(S.describe({ type: 'mesec', countFrom: 'calendar', day: 1 }, 'sl'), 'Vsak mesec, 1. dne, po koledarju');
  assert.equal(S.describe({ type: 'cetrtletje', countFrom: 'calendar', day: 10, months: '1,4,7,10' }, 'sl'),
    'Četrtletno, 10. dne v mesecih jan, apr, jul, okt, po koledarju');
  assert.equal(S.describe({ type: 'vec_let', countFrom: 'completion', interval: 2 }, 'sl'), 'Na 2 leti, od zadnje izvedbe');
  assert.equal(S.describe({ type: 'vec_let', countFrom: 'completion', interval: 3 }, 'sl'), 'Na 3 leta, od zadnje izvedbe');
  assert.equal(S.describe({ type: 'vec_let', countFrom: 'completion', interval: 5 }, 'sl'), 'Na 5 let, od zadnje izvedbe');
  assert.equal(S.describe({ type: 'n_dni', countFrom: 'calendar', interval: 14 }, 'sl'), 'Na 14 dni, po koledarju');
  assert.equal(S.describe({ type: 'teden', countFrom: 'calendar', weekday: 3 }, 'sl'), 'Vsako sredo, po koledarju');
  assert.equal(S.describe({ type: 'teden', countFrom: 'calendar', weekday: 1 }, 'sl'), 'Vsak ponedeljek, po koledarju');
  assert.equal(S.describe({}, 'sl'), 'Ponavljanje ni nastavljeno');
  assert.deepEqual(S.validate({ type: 'mesec', countFrom: 'calendar', day: 29, start: '2027-01-01' }, 'sl'),
    ['Dan v mesecu mora biti od 1 do 28.']);
  assert.equal(S.compute({ type: 'leto' }, [], 'sl').errors[0], 'Izberite, ali se rok šteje od izvedbe ali po koledarju.');
});
