import { h, mount, toast, fmtDate, fmtDateTime, field, select, formData, modal, askReason, busy } from './ui.js';
import * as api from './api.js';
import { prepareFile, toBase64, fmtBytes, MAX_UPLOAD_BYTES } from './image.js';
import { t, getLang, setLang, translateStatic, LANGUAGES } from './i18n.js';

const S = window.Schedule;
const app = document.getElementById('app');
const DISCLAIMER = () => t('Intervals are entered by users. This application does not provide legal advice and does not verify statutory deadlines.');

let state = null; // bootstrap data of the selected organisation

// ------------------------------------------------------------------ lookups

const byId = (list, id) => list.find((x) => x.id === id);
const active = (list) => list.filter((x) => !x.archived_at);
const typeName = (id) => byId(state.obligationTypes, id)?.name || '(type missing)';
const objectOf = (o) => byId(state.objects, o.object_id);
const contractorOf = (o) => byId(state.contractors, o.contractor_id);
const userName = (id) => { const u = byId(state.users, id); return u ? u.display_name || u.email : ''; };
const isAdmin = () => state.me.role === 'Admin';

function ruleOf(o) {
  return { type: o.rule_type, weekday: o.rule_weekday, interval: o.rule_interval, day: o.rule_day,
    months: o.rule_months, month: o.rule_month, start: o.start_date, countFrom: o.count_from,
    lastDoneBeforeApp: o.last_done_before_app };
}

function classOf(o) {
  return o.status === 'Incomplete' ? 'incomplete' : S.classify(o.next_due, state.today);
}

const CLASS_LABEL_EN = { overdue: 'Overdue', thisMonth: 'This month', nextMonth: 'Next month', later: 'Later', incomplete: 'Incomplete' };
const CLASS_LABEL = new Proxy(CLASS_LABEL_EN, { get: (o, k) => t(o[k]) });

function snoozeOf(o) {
  return state.snoozes.find((s) => s.obligation_id === o.id);
}

function replaceIn(list, rec) {
  const i = list.findIndex((x) => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
}

/** Object label: "K12 – Name", or only the name when there is no code or it equals the name. */
function objLabel(obj) {
  if (!obj) return '';
  const code = (obj.code || '').trim();
  return code && code.toLowerCase() !== (obj.name || '').trim().toLowerCase() ? `${code} – ${obj.name}` : obj.name;
}

function sortByCode(a, b) {
  return objLabel(a).localeCompare(objLabel(b), undefined, { numeric: true });
}

// ------------------------------------------------------------------ start

async function start() {
  if (!api.config().backends.length && !api.config().devLogin) {
    mount(app, h('div', { class: 'card' }, h('h1', {}, t('Not configured')),
      h('p', {}, t('This site has no backend configured (BACKENDS). See docs/POSTAVITEV.md.'))));
    return;
  }
  if (!api.hasValidToken()) return showSignIn();
  await enter();
}

function showSignIn(message) {
  setChrome(false);
  const btn = h('div', { class: 'gbtn' });
  const content = [h('h1', {}, 'Servisi'), h('p', { class: 'muted' }, t('Recurring obligations on your buildings and boiler rooms.')),
    message ? h('p', { class: 'error' }, message) : null, btn];
  if (api.config().devLogin) {
    const email = h('input', { type: 'email', placeholder: 'e-mail (development only)' });
    content.push(h('form', { onsubmit: (e) => { e.preventDefault(); api.setToken(`fake:${email.value.trim().toLowerCase()}:${api.config().googleClientId}`); enter(); } },
      email, h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, 'Sign in (dev)'))));
  } else {
    api.renderGoogleButton(btn, () => enter());
  }
  mount(app, h('div', { class: 'signin card' }, content));
}

async function enter() {
  mount(app, h('p', { class: 'muted center' }, t('Signing in…')));
  try {
    if (!api.currentBackend() || !api.config().backends.includes(api.currentBackend())) {
      const found = await api.discover();
      if (found.some((f) => f.error?.code === 'AUTH')) { api.signOut(); return showSignIn(t('Sign-in failed. Try again.')); }
      const known = found.filter((f) => f.known);
      if (known.length === 1) api.chooseBackend(known[0].url);
      else if (known.length > 1) return chooseOrg(known);
      else {
        const setupable = found.find((f) => f.setUp === false && f.canSetUp);
        if (setupable) return showSetup(setupable);
        const email = found.find((f) => f.email)?.email || '';
        api.signOut();
        return showSignIn(t('The account {e} is not on the access list. Ask your administrator to add it.', { e: email }));
      }
    }
    await reload();
    window.addEventListener('hashchange', route);
    route();
  } catch (e) {
    if (e.code === 'AUTH' || e.code === 'FORBIDDEN') { api.signOut(); return showSignIn(e.message); }
    showError(e);
  }
}

function chooseOrg(known) {
  setChrome(false);
  mount(app, h('div', { class: 'card' }, h('h1', {}, t('Choose organisation')),
    h('ul', { class: 'list' }, known.map((k) => h('li', {}, h('button', { class: 'link', onclick: () => { api.chooseBackend(k.url); enter(); } }, k.org.name))))));
}

function showSetup(target) {
  setChrome(false);
  const form = h('form', {},
    h('h1', {}, t('Set up Servisi')),
    h('p', { class: 'muted' }, t('You are the owner of this deployment ({e}). This is done once.', { e: target.email })),
    field(t('Organisation name'), h('input', { type: 'text', name: 'orgName', required: true })),
    field(t('Your name'), h('input', { type: 'text', name: 'displayName' })),
    field(t('Language'), select('language', LANGUAGES, getLang(), { onchange: (e) => { setLang(e.target.value); showSetup(target); } })),
    field(t('Spreadsheet (optional)'), h('input', { type: 'url', name: 'spreadsheet', placeholder: 'https://docs.google.com/spreadsheets/d/…' }),
      t('Leave empty to create a new spreadsheet in your Drive. To use a spreadsheet shared with you, paste its link (you need edit access).')),
    field(t('Attachment storage of another deployment (optional)'), h('input', { type: 'url', name: 'storageUrl' }),
      t('Leave empty to store attachments in your own Drive.')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Set up'))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = formData(form);
    try {
      await api.callAt(target.url, 'setup', { ...d, appUrl: location.origin + location.pathname, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      api.chooseBackend(target.url);
      toast(t('Set up.'));
      enter();
    } catch (err) { toast(err.message); }
  });
  mount(app, h('div', { class: 'card' }, form));
}

async function reload() {
  state = await api.call('bootstrap');
  if (state.settings.language && state.settings.language !== getLang()) setLang(state.settings.language);
  translateStatic();
  document.getElementById('org-name').textContent = state.org.name;
  setChrome(true);
  updateBanner();
}

function setChrome(on) {
  document.getElementById('topnav').hidden = !on;
  document.getElementById('bottomnav').hidden = !on;
  if (!on) document.getElementById('banner').hidden = true;
}

function updateBanner() {
  const b = document.getElementById('banner');
  const last = state.status.last_daily_run_at;
  const stale = !last || (Date.now() - new Date(last).getTime()) > 48 * 3600 * 1000;
  if (stale) {
    mount(b, last ? t('Daily check has not run since {d}. E-mails may not be sent. ', { d: fmtDateTime(last) })
      : t('Daily check has not run yet. E-mails are not being sent. '),
    isAdmin() ? h('a', { href: '#/settings/status' }, t('Open status')) : t('Tell your administrator.'));
    b.hidden = false;
  } else if (state.status.last_daily_run_ok === 'false') {
    mount(b, t('The last daily check reported errors. '), isAdmin() ? h('a', { href: '#/settings/status' }, t('Open status')) : t('Tell your administrator.'));
    b.hidden = false;
  } else b.hidden = true;
}

function showError(e) {
  mount(app, h('div', { class: 'card' }, h('h1', {}, t('Something went wrong')), h('p', { class: 'error' }, e.message),
    h('div', { class: 'actions' }, h('button', { onclick: () => location.reload() }, t('Reload')))));
}

// ------------------------------------------------------------------ router

const ROUTES = [
  [/^\/?$/, viewOverview, 'overview'],
  [/^\/objects$/, viewObjects, 'objects'],
  [/^\/object\/new$/, () => viewObjectForm(null), 'objects'],
  [/^\/object\/([^/]+)\/edit$/, (id) => viewObjectForm(id), 'objects'],
  [/^\/object\/([^/]+)$/, viewObject, 'objects'],
  [/^\/obligation\/new\/([^/]+)$/, (objId) => viewObligationForm(null, objId), 'objects'],
  [/^\/obligation\/([^/]+)\/edit$/, (id) => viewObligationForm(id), 'objects'],
  [/^\/obligation\/([^/]+)\/done$/, viewMarkDone, 'objects'],
  [/^\/obligation\/([^/]+)$/, viewObligation, 'objects'],
  [/^\/settings(?:\/([a-z]+))?$/, viewSettings, 'settings']
];

async function route() {
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  for (const [re, fn, nav] of ROUTES) {
    const m = re.exec(path);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
    try {
      await fn(...m.slice(1));
    } catch (e) {
      if (e.code === 'AUTH') { api.setToken(null); return showSignIn(e.message); }
      showError(e);
    }
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

function go(path) {
  if (location.hash === '#' + path) route(); else location.hash = '#' + path;
}

function footer() {
  return h('p', { class: 'disclaimer' }, DISCLAIMER(), ' · ', t('Version {v}', { v: state.version }), ' · ',
    h('button', { class: 'link small', onclick: () => { api.signOut(); location.hash = ''; location.reload(); } }, t('Sign out ({e})', { e: state.me.email })));
}

// ------------------------------------------------------------------ overview

let overviewTab = 'overdue';

function obligationRow(o, showObject) {
  const obj = objectOf(o);
  const cls = classOf(o);
  const c = contractorOf(o);
  const sn = snoozeOf(o);
  return h('a', { class: 'item', href: `#/obligation/${o.id}` },
    h('div', { class: 'grow' },
      h('div', { class: 'title' }, typeName(o.type_id)),
      showObject && obj ? h('div', { class: 'sub' }, objLabel(obj)) : null,
      h('div', { class: 'sub' }, S.describe(ruleOf(o), getLang()), c ? ` · ${c.name}` : '', sn ? ' · ' + t('reminder {d}', { d: fmtDate(sn.remind_on) }) : '')),
    h('div', { class: 'center' },
      h('div', { class: 'due' }, o.next_due ? fmtDate(o.next_due) : '—'),
      h('span', { class: `chip ${cls}` }, CLASS_LABEL[cls])));
}

function groupedByObject(list) {
  const groups = {};
  list.forEach((o) => { (groups[o.object_id] = groups[o.object_id] || []).push(o); });
  return Object.keys(groups).map((id) => byId(state.objects, id)).filter(Boolean).sort(sortByCode).map((obj) =>
    h('div', {}, h('div', { class: 'group-title' }, h('a', { href: `#/object/${obj.id}` }, objLabel(obj)),
      obj.address ? h('span', { class: 'muted small' }, ` · ${obj.address}`) : null),
    h('div', { class: 'list' }, groups[obj.id].sort((a, b) => (a.next_due || '').localeCompare(b.next_due || '')).map((o) => obligationRow(o, false)))));
}

async function viewOverview() {
  const live = active(state.obligations).filter((o) => { const obj = objectOf(o); return obj && !obj.archived_at; });
  const buckets = {
    overdue: live.filter((o) => classOf(o) === 'overdue'),
    thisMonth: live.filter((o) => classOf(o) === 'thisMonth'),
    nextMonth: live.filter((o) => classOf(o) === 'nextMonth'),
    snoozed: live.filter((o) => snoozeOf(o)),
    attention: live.filter((o) => classOf(o) === 'incomplete')
  };
  const activeObjects = active(state.objects);
  const noObligations = activeObjects.filter((obj) => !live.some((o) => o.object_id === obj.id));
  const noResponsible = activeObjects.filter((obj) => !obj.responsible_user_id);
  const attentionCount = buckets.attention.length + noObligations.length + noResponsible.length;
  const tabs = [['overdue', 'Overdue', buckets.overdue.length], ['thisMonth', 'This month', buckets.thisMonth.length],
    ['nextMonth', 'Next month', buckets.nextMonth.length], ['snoozed', t('Snoozed'), buckets.snoozed.length],
    ['attention', t('Needs attention'), attentionCount]];
  const body = h('div', {});
  const render = () => {
    tabBar.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === overviewTab));
    if (overviewTab === 'attention') {
      mount(body,
        buckets.attention.length ? [h('h3', {}, t('Incomplete repeat settings (no due date)')), groupedByObject(buckets.attention)] : null,
        noObligations.length ? [h('h3', {}, t('Objects without obligations')), h('div', { class: 'list' }, noObligations.sort(sortByCode).map((obj) =>
          h('a', { class: 'item', href: `#/object/${obj.id}` }, objLabel(obj))))] : null,
        noResponsible.length ? [h('h3', {}, t('Objects without a responsible user (e-mails go to administrators)')), h('div', { class: 'list' }, noResponsible.sort(sortByCode).map((obj) =>
          h('a', { class: 'item', href: `#/object/${obj.id}` }, objLabel(obj))))] : null,
        attentionCount ? null : h('p', { class: 'muted' }, t('Nothing needs attention.')));
    } else {
      const list = buckets[overviewTab];
      mount(body, list.length ? groupedByObject(list) : h('p', { class: 'muted' }, t('Nothing here.')));
    }
  };
  const tabBar = h('div', { class: 'tabs' }, tabs.map(([k, label, n]) =>
    h('button', { class: 'tab', dataset: { tab: k }, onclick: () => { overviewTab = k; render(); } }, label, h('span', { class: 'count' }, n))));
  mount(app, h('div', { class: 'row between' }, h('h1', {}, t('Overview')), h('span', { class: 'muted small' }, t('Today {d}', { d: fmtDate(state.today) }))),
    tabBar, h('div', { class: 'card' }, body), footer());
  render();
}

// ------------------------------------------------------------------ objects

let objectsFilter = { q: '', kind: '', archived: false };

async function viewObjects() {
  const listEl = h('div', { class: 'list' });
  const render = () => {
    const q = objectsFilter.q.toLowerCase();
    const list = state.objects.filter((o) => (objectsFilter.archived ? true : !o.archived_at))
      .filter((o) => !objectsFilter.kind || o.kind_id === objectsFilter.kind)
      .filter((o) => !q || [o.code, o.name, o.address].join(' ').toLowerCase().includes(q))
      .sort(sortByCode);
    mount(listEl, list.length ? list.map((obj) => {
      const obls = active(state.obligations).filter((o) => o.object_id === obj.id);
      const overdue = obls.filter((o) => classOf(o) === 'overdue').length;
      return h('a', { class: 'item', href: `#/object/${obj.id}` },
        h('div', { class: 'grow' }, h('div', { class: 'title' }, objLabel(obj)),
          h('div', { class: 'sub' }, [obj.address, byId(state.objectKinds, obj.kind_id)?.name, userName(obj.responsible_user_id)].filter(Boolean).join(' · '))),
        h('div', {}, obj.archived_at ? h('span', { class: 'chip' }, t('Archived')) : null,
          overdue ? h('span', { class: 'chip overdue' }, t('{n} overdue', { n: overdue })) : h('span', { class: 'chip' }, t('{n} obligations', { n: obls.length }))));
    }) : h('p', { class: 'muted' }, t('No objects.')));
  };
  const search = h('input', { type: 'text', placeholder: t('Search code, name, address'), value: objectsFilter.q,
    oninput: (e) => { objectsFilter.q = e.target.value; render(); } });
  const kind = select('kind', [{ value: '', label: t('All kinds') }, ...active(state.objectKinds).map((k) => ({ value: k.id, label: k.name }))],
    objectsFilter.kind, { onchange: (e) => { objectsFilter.kind = e.target.value; render(); } });
  mount(app, h('div', { class: 'row between' }, h('h1', {}, t('Objects')), h('a', { class: 'btn primary', href: '#/object/new' }, t('Add object'))),
    h('div', { class: 'search' }, search), h('div', { class: 'row' }, h('div', { class: 'grow' }, kind),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: objectsFilter.archived,
        onchange: (e) => { objectsFilter.archived = e.target.checked; render(); } }), t('Show archived'))),
    h('div', { class: 'card' }, listEl), footer());
  render();
}

async function viewObject(id) {
  const obj = byId(state.objects, id);
  if (!obj) throw new Error(t('Object not found.'));
  const obls = state.obligations.filter((o) => o.object_id === id);
  const live = obls.filter((o) => !o.archived_at);
  const archived = obls.filter((o) => o.archived_at);
  const archiveBtn = h('button', { class: 'danger' }, obj.archived_at ? t('Restore') : t('Archive'));
  archiveBtn.onclick = busy(archiveBtn, async () => {
    if (obj.archived_at) {
      await api.call('restoreObject', { id, rev: obj.rev });
    } else {
      const reason = await askReason(t('Archive {c}?', { c: objLabel(obj) }), t('Reason (its {n} obligations are archived with it)', { n: live.length }));
      if (!reason) return;
      await api.call('archiveObject', { id, reason, rev: obj.rev });
    }
    await reload();
    route();
  });
  mount(app,
    h('p', {}, h('a', { href: '#/objects' }, t('← Objects'))),
    h('h1', {}, objLabel(obj)),
    obj.archived_at ? h('p', { class: 'notice' }, t('Archived {d}: {r}', { d: fmtDateTime(obj.archived_at), r: obj.archive_reason })) : null,
    h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', {}, t('Address')), h('dd', {}, obj.address || '—'),
      h('dt', {}, t('Kind')), h('dd', {}, byId(state.objectKinds, obj.kind_id)?.name || '—'),
      h('dt', {}, t('Responsible')), h('dd', {}, userName(obj.responsible_user_id) || t('nobody – e-mails go to administrators')),
      h('dt', {}, t('Site contact')), h('dd', {}, obj.site_contact || '—'),
      h('dt', {}, t('Note')), h('dd', {}, obj.note || '—'))),
    h('div', { class: 'actions' },
      obj.archived_at ? null : h('a', { class: 'btn primary', href: `#/obligation/new/${id}` }, t('Add obligation')),
      obj.archived_at ? null : h('a', { class: 'btn', href: `#/object/${id}/edit` }, t('Edit')), archiveBtn),
    h('h2', {}, t('Obligations ({n})', { n: live.length })),
    h('div', { class: 'card' }, live.length ? h('div', { class: 'list' },
      live.sort((a, b) => (a.next_due || '9').localeCompare(b.next_due || '9')).map((o) => obligationRow(o, false)))
      : h('p', { class: 'muted' }, t('No obligations yet.'))),
    archived.length ? [h('h2', {}, t('Archived obligations ({n})', { n: archived.length })), h('div', { class: 'card' }, h('div', { class: 'list' },
      archived.map((o) => h('a', { class: 'item', href: `#/obligation/${o.id}` }, h('div', { class: 'grow' }, typeName(o.type_id)),
        h('span', { class: 'chip' }, t('Archived'))))))] : null,
    footer());
}

async function viewObjectForm(id) {
  const obj = id ? byId(state.objects, id) : {};
  if (id && !obj) throw new Error(t('Object not found.'));
  const users = active(state.users).filter((u) => u.active === 'true');
  const form = h('form', {},
    field(t('Name'), h('input', { type: 'text', name: 'name', required: true, value: obj.name || '' })),
    field(t('Code (optional)'), h('input', { type: 'text', name: 'code', value: obj.code || '' }), t('Short label, e.g. K12. Leave empty if it is the same as the name.')),
    field(t('Address'), h('input', { type: 'text', name: 'address', value: obj.address || '' })),
    field(t('Kind'), h('input', { type: 'text', name: 'kind_name', list: 'object-kinds', autocomplete: 'off',
      value: byId(state.objectKinds, obj.kind_id)?.name || '' }), t('Choose from the list or type your own; a new kind is added to the list.')),
    h('datalist', { id: 'object-kinds' }, active(state.objectKinds).map((k) => h('option', { value: k.name }))),
    field(t('Responsible user'), select('responsible_user_id', [{ value: '', label: t('— (e-mails go to administrators)') },
      ...users.map((u) => ({ value: u.id, label: u.display_name || u.email }))], obj.responsible_user_id),
    t('Receives the monthly e-mail for this object.')),
    field(t('Site contact'), h('input', { type: 'text', name: 'site_contact', value: obj.site_contact || '' }), t('Caretaker, owners\' representative, phone…')),
    field(t('Note'), h('textarea', { name: 'note' }, obj.note || '')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Save')),
      h('a', { class: 'btn', href: id ? `#/object/${id}` : '#/objects' }, t('Cancel'))));
  const submit = form.querySelector('button[type=submit]');
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  const save = busy(submit, async () => {
    try {
      const saved = await api.call('saveObject', { ...formData(form), id: id || undefined, rev: obj.rev });
      replaceIn(state.objects, saved);
      if (saved.kind_id && !byId(state.objectKinds, saved.kind_id)) await reload();
      toast(t('Saved.'));
      go(`/object/${saved.id}`);
    } catch (err) { toast(err.message); }
  });
  mount(app, h('h1', {}, id ? t('Edit {c}', { c: objLabel(obj) }) : t('Add object')), h('div', { class: 'card' }, form));
}

// ------------------------------------------------------------------ obligation

async function viewObligation(id) {
  const o = byId(state.obligations, id);
  if (!o) throw new Error(t('Obligation not found.'));
  const obj = objectOf(o);
  const c = contractorOf(o);
  const cls = classOf(o);
  const historyEl = h('div', {}, h('p', { class: 'muted' }, t('Loading history…')));
  const sn = snoozeOf(o);
  const archiveBtn = h('button', { class: 'danger' }, o.archived_at ? t('Restore') : t('Archive'));
  archiveBtn.onclick = busy(archiveBtn, async () => {
    try {
      if (o.archived_at) await api.call('restoreObligation', { id, rev: o.rev });
      else {
        const reason = await askReason(t('Archive this obligation?'));
        if (!reason) return;
        await api.call('archiveObligation', { id, reason, rev: o.rev });
      }
      await reload();
      route();
    } catch (err) { toast(err.message); }
  });
  const recipients = JSON.parse(o.extra_recipients || '[]').map((r) => (r.userId ? userName(r.userId) : r.email));
  const upcoming = o.next_due ? S.upcoming(ruleOf(o), o.next_due, 5) : [];
  mount(app,
    h('p', {}, h('a', { href: `#/object/${o.object_id}` }, `← ${obj ? objLabel(obj) : t('Object')}`)),
    h('h1', {}, typeName(o.type_id)),
    o.archived_at ? h('p', { class: 'notice' }, t('Archived {d}: {r}', { d: fmtDateTime(o.archived_at), r: o.archive_reason })) : null,
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('div', {}, h('div', { class: 'muted small' }, t('Next due')),
        h('div', { class: 'due', style: 'font-size:1.4rem' }, o.next_due ? fmtDate(o.next_due) : '—')),
      h('span', { class: `chip ${cls}` }, CLASS_LABEL[cls])),
      o.status === 'Incomplete' ? h('p', { class: 'error' }, t('Repeat settings are incomplete, so no due date can be computed: '),
        S.validate(ruleOf(o), getLang()).join(' ')) : null,
      sn ? h('p', { class: 'notice' }, t('Reminder on {d}', { d: fmtDate(sn.remind_on) }) + (sn.note ? ': ' + sn.note : '') + ' ',
        h('button', { class: 'link', onclick: async () => { await api.call('cancelSnooze', { id: sn.id }); await reload(); route(); } }, t('Cancel reminder'))) : null,
      h('dl', { class: 'kv' },
        h('dt', {}, t('Repeat')), h('dd', {}, S.describe(ruleOf(o), getLang())),
        upcoming.length > 1 ? [h('dt', {}, t('Then')), h('dd', {}, upcoming.slice(1).map(fmtDate).join(', '))] : null,
        h('dt', {}, t('Contractor')), h('dd', {}, c ? [c.name, c.phone ? ' · ' : '', c.phone ? h('a', { href: `tel:${c.phone}` }, c.phone) : ''] : '—'),
        h('dt', {}, t('Warning')), h('dd', {}, o.warn_days_before ? t('{n} days before due', { n: o.warn_days_before }) : '—'),
        h('dt', {}, t('Also notify')), h('dd', {}, recipients.length ? recipients.join(', ') : '—'),
        h('dt', {}, t('Note')), h('dd', {}, o.note || '—'))),
    o.archived_at ? h('div', { class: 'actions' }, archiveBtn) : h('div', { class: 'actions' },
      o.status === 'Active' ? h('a', { class: 'btn primary', href: `#/obligation/${id}/done` }, t('Mark done')) : null,
      h('button', { onclick: () => remindMe(o) }, t('Remind me')),
      h('button', { onclick: () => requestQuote(o) }, t('Request quote')),
      h('a', { class: 'btn', href: `#/obligation/${id}/edit` }, t('Edit')), archiveBtn),
    h('h2', {}, t('History')), h('div', { class: 'card' }, historyEl), footer());
  const hist = await api.call('history', { obligation_id: id });
  renderHistory(historyEl, hist);
}

function renderHistory(el, hist) {
  const byCompletion = {};
  hist.attachments.forEach((a) => { (byCompletion[a.completion_id] = byCompletion[a.completion_id] || []).push(a); });
  const computedById = {};
  hist.computed.history.forEach((x) => { if (x.kind === 'done') computedById[x.id] = x; });
  const rows = [];
  hist.completions.forEach((c) => rows.push({ date: c.done_date, c }));
  hist.computed.history.filter((x) => x.kind === 'skipped').forEach((s) => rows.push({ date: s.due, skipped: s }));
  (hist.quotes || []).forEach((q) => rows.push({ date: q.sent_at.slice(0, 10), quote: q }));
  rows.sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return mount(el, h('p', { class: 'muted' }, t('Not done yet in this application.')));
  mount(el, h('div', { class: 'list' }, rows.map((r) => {
    if (r.quote) {
      const q = r.quote;
      return h('div', { class: 'item' }, h('div', { class: 'grow' },
        h('div', { class: 'title' }, t({ send: 'Quote requested {d}', self: 'Quote request sent to me for forwarding {d}' }[q.method] || 'Quote request drafted {d}', { d: fmtDateTime(q.sent_at) })),
        h('div', { class: 'sub' }, t('to {r} · by {u}', { r: q.recipient, u: q.created_by })),
        h('details', {}, h('summary', { class: 'small' }, q.subject), h('pre', { class: 'small', style: 'white-space:pre-wrap' }, q.body))),
      h('span', { class: 'chip' }, t('Quote')));
    }
    if (r.skipped) {
      return h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, t('Skipped due date {d}', { d: fmtDate(r.skipped.due) })),
        h('div', { class: 'sub' }, t('Passed over because the previous due date was done late (calendar counting).'))),
      h('span', { class: 'chip' }, t('Skipped')));
    }
    const c = r.c;
    const comp = computedById[c.id];
    const voidBtn = h('button', { class: 'link small' }, t('Void'));
    voidBtn.onclick = busy(voidBtn, async () => {
      const reason = await askReason(t('Void this completion?'), t('Reason (the record stays in the history)'));
      if (!reason) return;
      try {
        const res = await api.call('voidCompletion', { id: c.id, reason, rev: c.rev });
        replaceIn(state.obligations, res.obligation);
        toast(t('Voided. Due date recalculated.'));
        route();
      } catch (err) { toast(err.message); }
    });
    return h('div', { class: 'item' }, h('div', { class: 'grow' },
      h('div', { class: 'title', style: c.void_at ? 'text-decoration:line-through' : '' }, t('Done {d}', { d: fmtDate(c.done_date) }),
        comp ? h('span', { class: 'muted small' }, t(' · closed due {d}', { d: fmtDate(comp.due) })) : null),
      h('div', { class: 'sub' }, t('by {u} · recorded {d}', { u: c.done_by, d: fmtDateTime(c.created_at) })),
      c.note ? h('div', {}, c.note) : null,
      c.void_at ? h('div', { class: 'error small' }, t('Voided {d} by {u}: {r}', { d: fmtDateTime(c.void_at), u: c.void_by, r: c.void_reason })) : null,
      (byCompletion[c.id] || []).map((a) => h('div', { class: 'small' }, h('a', { href: a.url, target: '_blank', rel: 'noopener' },
        `${t(a.kind)}: ${a.file_name}`), a.size_bytes ? ` (${fmtBytes(+a.size_bytes)})` : ''))),
    h('div', {}, c.void_at ? h('span', { class: 'chip' }, t('Voided')) : [comp?.late ? h('span', { class: 'chip overdue' }, t('Late')) : h('span', { class: 'chip ok' }, t('On time')), ' ', voidBtn]));
  })));
}

const QUOTE_SUBJECT = 'Request for quote: {type} – {object}';
const QUOTE_BODY = 'Dear Sir or Madam,\n\nwe kindly ask for a quote for: {type}\nObject: {object}\nAddress: {address}\n' +
  'Due date: {due}\nSite contact: {site_contact}\nNote: {note}\n\n' +
  'Please include the price and the earliest possible date of execution.\n\nKind regards,\n{sender}';

/** Fills {placeholders}; a line whose placeholders are all empty is left out. */
function fillTemplate(text, vals) {
  return text.split('\n').filter((line) => {
    const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return !keys.length || keys.some((k) => vals[k]);
  }).map((line) => line.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m))).join('\n');
}

async function requestQuote(o) {
  const obj = objectOf(o);
  const c = contractorOf(o);
  const vals = {
    type: typeName(o.type_id), object: obj ? objLabel(obj) : '', address: obj?.address || '',
    due: o.next_due ? fmtDate(o.next_due) : '', site_contact: obj?.site_contact || '', note: o.note || '',
    contractor: c?.name || '', sender: state.me.display_name || state.me.email
  };
  const subject = fillTemplate(state.settings.quote_subject || t(QUOTE_SUBJECT), vals);
  const body = fillTemplate(state.settings.quote_body || t(QUOTE_BODY), vals);
  const res = await modal((close) => {
    const to = h('input', { type: 'text', name: 'to', value: c?.email || '', placeholder: 'name@example.com' });
    const subj = h('input', { type: 'text', name: 'subject', value: subject });
    const text = h('textarea', { name: 'body', style: 'min-height:260px' }, body);
    const read = (method) => ({ method, to: to.value.trim(), subject: subj.value.trim(), body: text.value });
    return h('form', { onsubmit: (e) => { e.preventDefault(); close(read('draft')); } },
      h('h2', {}, t('Request quote')),
      c ? null : h('p', { class: 'notice' }, t('No contractor is set for this obligation. Enter the e-mail address.')),
      field(t('To'), to, t('Several addresses separated by commas.')), field(t('Subject'), subj), field(t('Text'), text),
      h('p', { class: 'hint' }, t('Open as draft: your own e-mail program opens with the request; you send it from your own address.')),
      h('p', { class: 'hint' }, t('Send to me for forwarding: the request arrives at {e}; forward it to contractors from there.', { e: state.me.notify_email || state.me.email })),
      h('p', { class: 'hint' }, t('Send to contractor: the application sends it; replies and a copy go to {e}.', { e: state.me.notify_email || state.me.email })),
      h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Open as draft')),
        h('button', { type: 'button', onclick: () => close(read('self')) }, t('Send to me for forwarding')),
        h('button', { type: 'button', onclick: () => close(read('send')) }, t('Send to contractor')),
        h('button', { type: 'button', onclick: () => close(null) }, t('Cancel'))));
  });
  if (!res) return;
  try {
    if (res.method === 'draft') {
      location.href = `mailto:${encodeURIComponent(res.to).replace(/%2C/g, ',').replace(/%40/g, '@')}` +
        `?subject=${encodeURIComponent(res.subject)}&body=${encodeURIComponent(res.body)}`;
    }
    await api.call('requestQuote', { obligation_id: o.id, ...res });
    toast(res.method === 'send' ? t('Quote request sent.') : res.method === 'self'
      ? t('Sent to {e} for forwarding.', { e: state.me.notify_email || state.me.email }) : t('Draft opened and recorded in the history.'));
    route();
  } catch (err) { toast(err.message); }
}

async function remindMe(o) {
  const res = await modal((close) => {
    const days = h('input', { type: 'number', name: 'days', min: 1, max: 366, placeholder: t('e.g. 7') });
    const date = h('input', { type: 'date', name: 'remind_on', min: S.addDays(state.today, 1) });
    const note = h('textarea', { name: 'note' });
    return h('form', { onsubmit: (e) => { e.preventDefault(); close({ days: days.value, remind_on: date.value, note: note.value }); } },
      h('h2', {}, t('Remind me')),
      h('p', { class: 'muted small' }, t('Sends you an extra e-mail on that day. The regular due date does not change.')),
      field(t('In how many days'), days), field(t('…or on date'), date), field(t('Note'), note),
      h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Set reminder')),
        h('button', { type: 'button', onclick: () => close(null) }, t('Cancel'))));
  });
  if (!res) return;
  try {
    const s = await api.call('snooze', { obligation_id: o.id, days: res.remind_on ? '' : res.days, remind_on: res.remind_on, note: res.note });
    state.snoozes.push(s);
    toast(t('Reminder set for {d}.', { d: fmtDate(s.remind_on) }));
    route();
  } catch (err) { toast(err.message); }
}

// ------------------------------------------------------------------ obligation form (rule editor)

const REPEAT_OPTIONS = () => [
  { value: '', label: t('— choose —') },
  { value: 'mesec', label: t('Monthly') },
  { value: 'cetrtletje', label: t('Quarterly') },
  { value: 'polletje', label: t('Half-yearly') },
  { value: 'leto', label: t('Yearly') },
  { value: 'vec_let', label: t('Every N years') },
  { group: t('Advanced (short intervals)'), options: [
    { value: 'n_dni', label: t('Every N days') }, { value: 'teden', label: t('Weekly') }, { value: 'dan', label: t('Daily') }] }
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

async function viewObligationForm(id, objectId) {
  const o = id ? byId(state.obligations, id) : { object_id: objectId, count_from: 'calendar' };
  if (!o) throw new Error(t('Obligation not found.'));
  const obj = byId(state.objects, o.object_id);
  const recips = JSON.parse(o.extra_recipients || '[]');
  const months = String(o.rule_months || '').split(',').filter(Boolean);
  const types = active(state.obligationTypes);
  const groups = active(state.obligationGroups).sort((a, b) => (+a.sort || 0) - (+b.sort || 0));
  // Type and contractor can be picked from a list or typed; a new name is added to the catalog on save.
  const typeLabel = (ty) => {
    const g = byId(groups, ty.group_id);
    const same = types.filter((x) => x.name.toLowerCase() === ty.name.toLowerCase()).length > 1;
    return same && g ? `${ty.name} (${g.name})` : ty.name;
  };
  const typeByLabel = Object.fromEntries(types.map((ty) => [typeLabel(ty).toLowerCase(), ty]));
  const curType = byId(state.obligationTypes, o.type_id);
  const contractors = active(state.contractors);
  const curContractor = byId(state.contractors, o.contractor_id);
  const users = active(state.users).filter((u) => u.active === 'true');

  const dayF = field(t('Day of month'), h('input', { type: 'number', name: 'rule_day', min: 1, max: 28, value: o.rule_day || '' }), t('1 to 28, so that every month has it.'));
  const monthsF = field(t('Months'), h('div', { class: 'months' }, MONTHS.map((m, i) => h('label', {},
    h('input', { type: 'checkbox', name: 'rule_months', value: String(i + 1), dataset: { multi: '1' }, checked: months.includes(String(i + 1)) }), m))));
  const monthF = field(t('Month'), select('rule_month', [{ value: '', label: '—' }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))], o.rule_month));
  const weekdayF = field(t('Weekday'), select('rule_weekday', [{ value: '', label: '—' }, ...WEEKDAYS.map((w, i) => ({ value: String(i + 1), label: w }))], o.rule_weekday));
  const intervalF = field(t('Interval'), h('input', { type: 'number', name: 'rule_interval', min: 1, value: o.rule_interval || '' }));
  const preview = h('div', { class: 'notice' });

  const form = h('form', {},
    field(t('Obligation type'), h('input', { type: 'text', name: 'type_label', list: 'obligation-types', required: true, autocomplete: 'off',
      value: curType ? typeLabel(curType) : '' }),
      t('Choose from the list or type a new one; it is added to the obligation types.')),
    h('datalist', { id: 'obligation-types' }, types.map((ty) => h('option', { value: typeLabel(ty) }))),
    field(t('Contractor'), h('input', { type: 'text', name: 'contractor_name', list: 'contractors', autocomplete: 'off',
      value: curContractor ? curContractor.name : '', oninput: (e) => fillContractor(e.target.value) }),
      t('Choose from the list or type a new one; it is added to the contractors.')),
    h('datalist', { id: 'contractors' }, contractors.map((c) => h('option', { value: c.name }))),
    h('div', { class: 'row' },
      h('div', { class: 'grow' }, field(t('Contractor e-mail'), h('input', { type: 'email', name: 'contractor_email', value: curContractor?.email || '' }))),
      h('div', { class: 'grow' }, field(t('Contractor phone'), h('input', { type: 'text', name: 'contractor_phone', value: curContractor?.phone || '' })))),
    h('h2', {}, t('Repeat')),
    h('div', { class: 'field' }, h('label', {}, t('Count the next due date')),
      h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'count_from', value: 'calendar', checked: o.count_from === 'calendar' }), t('By calendar (fixed dates)')),
      h('label', { class: 'inline' }, h('input', { type: 'radio', name: 'count_from', value: 'completion', checked: o.count_from === 'completion' }), t('From the last completion')),
      h('div', { class: 'hint' }, t('By calendar: a late completion does not move later due dates. From the last completion: a delay moves all later due dates.'))),
    field(t('Repeats'), select('rule_type', REPEAT_OPTIONS(), o.rule_type)),
    dayF, monthsF, monthF, weekdayF, intervalF,
    field(t('Start date'), h('input', { type: 'date', name: 'start_date', value: o.start_date || '' }), t('The first due date is on or after this date.')),
    field(t('Last done before this app (optional)'), h('input', { type: 'date', name: 'last_done_before_app', max: state.today, value: o.last_done_before_app || '' }),
      t('If you know when it was last done, the first due date is counted from it.')),
    preview,
    h('h2', {}, t('Notifications')),
    field(t('Warn days before due (optional)'), h('input', { type: 'number', name: 'warn_days_before', min: 0, max: 365, value: o.warn_days_before || '' }),
      t('Sends an extra e-mail this many days before the due date.')),
    h('div', { class: 'field' }, h('label', {}, t('Also notify users')), users.map((u) => h('label', { class: 'inline' },
      h('input', { type: 'checkbox', name: 'recipient_users', value: u.id, dataset: { multi: '1' }, checked: recips.some((r) => r.userId === u.id) }), u.display_name || u.email)),
    h('div', { class: 'hint' }, t('The responsible user of the object ({u}) always gets it.', { u: userName(obj?.responsible_user_id) || t('administrators') }))),
    field(t('Also notify e-mail addresses (optional)'), h('textarea', { name: 'recipient_emails' }, recips.filter((r) => r.email).map((r) => r.email).join('\n')),
      t('One per line, e.g. the contractor. They receive only their own lines, without links.')),
    field(t('Note'), h('textarea', { name: 'note' }, o.note || '')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Save')),
      h('a', { class: 'btn', href: id ? `#/obligation/${id}` : `#/object/${o.object_id}` }, t('Cancel'))));

  function fillContractor(name) {
    const c = contractors.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
    if (!c) return;
    form.elements.contractor_email.value = c.email || '';
    form.elements.contractor_phone.value = c.phone || '';
  }

  const currentRule = () => {
    const d = formData(form);
    return { type: d.rule_type, weekday: d.rule_weekday, interval: d.rule_interval, day: d.rule_day, months: d.rule_months,
      month: d.rule_month, start: d.start_date, countFrom: d.count_from, lastDoneBeforeApp: d.last_done_before_app };
  };
  const refresh = () => {
    const r = currentRule();
    const cal = r.countFrom === 'calendar';
    dayF.hidden = !(cal && ['mesec', 'cetrtletje', 'polletje', 'leto', 'vec_let'].includes(r.type));
    monthsF.hidden = !(cal && ['cetrtletje', 'polletje'].includes(r.type));
    monthF.hidden = !(cal && ['leto', 'vec_let'].includes(r.type));
    weekdayF.hidden = !(cal && r.type === 'teden');
    intervalF.hidden = !['n_dni', 'vec_let'].includes(r.type);
    intervalF.querySelector('label').textContent = r.type === 'vec_let' ? t('Every how many years') : t('Every how many days');
    if (id) {
      mount(preview, t('Description: '), h('b', {}, S.describe(r, getLang())), t('. The due date is recalculated from the history when you save.'));
      return;
    }
    const res = S.compute(r, [], getLang());
    if (!res.complete) mount(preview, h('b', {}, t('Not complete yet: ')), res.errors.join(' '));
    else mount(preview, h('b', {}, S.describe(r, getLang())), h('br'), t('Due dates: '), S.upcoming(r, res.nextDue, 5).map(fmtDate).join(', '));
  };
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  const submit = form.querySelector('button[type=submit]');
  const save = busy(submit, async () => {
    const d = formData(form);
    const extra = (d.recipient_users || []).map((u) => ({ userId: u }))
      .concat(d.recipient_emails.split(/[\s,;]+/).filter(Boolean).map((e) => ({ email: e })));
    const payload = { ...d, rule_months: (d.rule_months || []).join(','), extra_recipients: extra, object_id: o.object_id, id: id || undefined, rev: o.rev };
    const ty = typeByLabel[(d.type_label || '').trim().toLowerCase()];
    if (ty) payload.type_id = ty.id; else payload.type_name = (d.type_label || '').trim();
    delete payload.type_label;
    delete payload.recipient_users;
    delete payload.recipient_emails;
    try {
      const saved = await api.call('saveObligation', payload);
      replaceIn(state.obligations, saved);
      if (!byId(state.obligationTypes, saved.type_id) || (saved.contractor_id && !byId(state.contractors, saved.contractor_id)) ||
        payload.contractor_email || payload.contractor_phone) await reload();
      toast(saved.status === 'Incomplete' ? t('Saved, but the repeat settings are incomplete.') : t('Saved. Next due {d}.', { d: fmtDate(saved.next_due) }));
      go(`/obligation/${saved.id}`);
    } catch (err) { toast(err.message); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  mount(app, h('p', {}, h('a', { href: `#/object/${o.object_id}` }, `← ${obj ? objLabel(obj) : t('Object')}`)),
    h('h1', {}, id ? t('Edit obligation') : t('Add obligation')), h('div', { class: 'card' }, form), footer());
  refresh();
}

// ------------------------------------------------------------------ mark done

const KINDS = ['Report', 'Invoice', 'Photo', 'Measurement', 'Other'];

async function viewMarkDone(id) {
  const o = byId(state.obligations, id);
  if (!o) throw new Error(t('Obligation not found.'));
  const obj = objectOf(o);
  const files = []; // { file, kind, status, result, row }
  const fileList = h('div', { class: 'file-list' });
  const doneDate = h('input', { type: 'date', name: 'done_date', required: true, max: state.today, value: state.today });
  const note = h('textarea', { name: 'note' });
  const effect = h('div', { class: 'notice' });
  const completions = await api.call('history', { obligation_id: id });

  const showEffect = () => {
    const valid = completions.completions.filter((c) => !c.void_at).map((c) => ({ id: c.id, doneDate: c.done_date, order: c.created_at }));
    if (!S.isDate(doneDate.value)) return mount(effect, t('Enter the date.'));
    const after = S.compute(ruleOf(o), valid.concat([{ id: 'new', doneDate: doneDate.value, order: 'z' }]));
    const closed = after.history.find((x) => x.id === 'new');
    const skipped = after.history.filter((x) => x.kind === 'skipped' && x.due > (closed?.due || ''));
    mount(effect, t('This closes the due date {d}{late}. ', { d: fmtDate(closed?.due), late: closed?.late ? t(' (late)') : '' }),
      h('b', {}, t('Next due: {d}.', { d: fmtDate(after.nextDue) })),
      skipped.length ? t(' Skipped as missed: {d}.', { d: skipped.map((s) => fmtDate(s.due)).join(', ') }) : '');
  };
  doneDate.addEventListener('input', showEffect);

  const renderFiles = () => mount(fileList, files.map((f, i) => {
    const kind = select('kind', KINDS.map((k) => ({ value: k, label: t(k) })), f.kind, { onchange: (e) => { f.kind = e.target.value; } });
    return h('div', { class: 'file-row' }, h('div', { class: 'grow' }, f.file.name,
      h('div', { class: 'muted small' }, f.status || fmtBytes(f.file.size))), kind,
    f.result ? null : h('button', { type: 'button', class: 'link', onclick: () => { files.splice(i, 1); renderFiles(); } }, t('Remove')));
  }));
  const addFiles = (list) => {
    for (const file of list) {
      files.push({ file, kind: file.type.startsWith('image/') ? 'Photo' : 'Report' });
    }
    renderFiles();
  };
  const camera = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
  const picker = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, hidden: true, onchange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
  const submit = h('button', { class: 'primary', type: 'submit' }, t('Save as done'));
  const form = h('form', {},
    field(t('Date done'), doneDate), effect, field(t('Note'), note),
    h('div', { class: 'field' }, h('label', {}, t('Attachments')),
      h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => camera.click() }, t('Camera')),
        h('button', { type: 'button', onclick: () => picker.click() }, t('File')), camera, picker),
      h('div', { class: 'hint' }, t('Report, invoice, photo or measurement (PDF or image). Photos are reduced to 1600 px before upload.')),
      fileList),
    h('div', { class: 'actions' }, submit, h('a', { class: 'btn', href: `#/obligation/${id}` }, t('Cancel'))));

  const storageUrl = state.settings.storage_url || api.currentBackend();
  const uploadAll = async () => {
    for (const f of files) {
      if (f.result) continue;
      f.status = t('Preparing…');
      renderFiles();
      const prepared = await prepareFile(f.file);
      if (prepared.blob.size > MAX_UPLOAD_BYTES) throw new Error(t('{f} is larger than 25 MB.', { f: f.file.name }));
      f.status = t('Uploading {s}{was}…', { s: fmtBytes(prepared.blob.size), was: prepared.resized ? t(' (was {s})', { s: fmtBytes(prepared.originalSize) }) : '' });
      renderFiles();
      f.result = await api.callAt(storageUrl, 'upload', {
        mime: prepared.mime, base64: await toBase64(prepared.blob), date: doneDate.value, kind: f.kind,
        fileName: f.file.name, originalSize: prepared.originalSize, objectFolder: obj ? objLabel(obj) : 'unknown'
      }, 180000);
      f.status = t('Uploaded {s}', { s: fmtBytes(+f.result.size_bytes) });
      renderFiles();
    }
  };
  const save = busy(submit, async () => {
    try {
      await uploadAll();
      const res = await api.call('markDone', {
        obligation_id: id, done_date: doneDate.value, note: note.value, expected_due: o.next_due,
        attachments: files.map((f) => ({ ...f.result, kind: f.kind }))
      });
      replaceIn(state.obligations, res.obligation);
      state.snoozes = state.snoozes.filter((s) => s.obligation_id !== id);
      toast(t('Done. Next due {d}.', { d: fmtDate(res.obligation.next_due) }));
      go(`/obligation/${id}`);
    } catch (err) {
      toast(err.message);
      files.forEach((f) => { if (!f.result) f.status = t('Not uploaded – press Save again to retry'); });
      renderFiles();
    }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  mount(app, h('p', {}, h('a', { href: `#/obligation/${id}` }, t('← Back'))),
    h('h1', {}, t('Mark done')), h('p', { class: 'muted' }, `${typeName(o.type_id)} · ${obj ? objLabel(obj) : ''}`),
    h('div', { class: 'card' }, form), footer());
  showEffect();
}

// ------------------------------------------------------------------ settings

const SETTINGS_TABS = () => [['general', t('Notifications')], ['users', t('Users')], ['types', t('Obligation types')],
  ['contractors', t('Contractors')], ['kinds', t('Object kinds')], ['storage', t('Storage')], ['status', t('Status')], ['data', t('Export / import')]];

async function viewSettings(tab = '') {
  const tabs = isAdmin() ? SETTINGS_TABS() : SETTINGS_TABS().filter(([k]) => k === 'contractors');
  if (!tab) tab = tabs[0][0];
  const body = h('div', {});
  mount(app, h('h1', {}, t('Settings')),
    h('div', { class: 'tabs' }, tabs.map(([k, label]) => h('a', { class: 'tab' + (k === tab ? ' active' : ''), href: `#/settings/${k}`, style: 'text-decoration:none' }, label))),
    body, footer());
  const views = { general: settingsGeneral, users: settingsUsers, types: settingsTypes, contractors: settingsContractors,
    kinds: settingsKinds, storage: settingsStorage, status: settingsStatus, data: settingsData };
  if (!tabs.some(([k]) => k === tab)) return mount(body, h('p', { class: 'muted' }, t('Only administrators can change this.')));
  await views[tab](body);
}

function settingsGeneral(el) {
  const s = state.settings;
  const form = h('form', {},
    field(t('Day of the monthly e-mail'), h('input', { type: 'number', name: 'monthly_day', min: 1, max: 28, value: s.monthly_day }),
      t('If the daily check misses that day, the e-mail is sent at the next run.')),
    field(t('Hour of the daily check'), h('input', { type: 'number', name: 'run_hour', min: 0, max: 23, value: s.run_hour }), t('Time zone {z}. Google runs it within that hour.', { z: state.org.timezone })),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'weekly_overdue_reminder', checked: s.weekly_overdue_reminder === 'true' }),
      t('Weekly reminder on Mondays when something is overdue')),
    field(t('Language of the application and the e-mails'), select('language', LANGUAGES, s.language || 'sl')),
    field(t('Sender name'), h('input', { type: 'text', name: 'mail_sender_name', value: s.mail_sender_name || '' })),
    field(t('Quote request – subject'), h('input', { type: 'text', name: 'quote_subject', value: s.quote_subject || '', placeholder: t(QUOTE_SUBJECT) })),
    field(t('Quote request – text'), h('textarea', { name: 'quote_body', style: 'min-height:200px', placeholder: t(QUOTE_BODY) }, s.quote_body || ''),
      t('Empty = default text. Placeholders: {type} {object} {address} {due} {site_contact} {note} {contractor} {sender}. A line whose placeholders are empty is left out.')),
    field(t('Application link (used in e-mails)'), h('input', { type: 'url', name: 'app_url', value: s.app_url || '' })),
    field(t('Attachment storage of another deployment'), h('input', { type: 'url', name: 'storage_url', value: s.storage_url || '' }),
      t('Empty = attachments are stored by this deployment.')),
    h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Save'))));
  const submit = form.querySelector('button[type=submit]');
  const save = busy(submit, async () => {
    const d = formData(form);
    d.weekly_overdue_reminder = d.weekly_overdue_reminder ? 'true' : 'false';
    try {
      state.settings = await api.call('saveSettings', { values: d });
      if (state.settings.language && state.settings.language !== getLang()) {
        setLang(state.settings.language);
        translateStatic();
        route();
      }
      toast(t('Saved.'));
    } catch (err) { toast(err.message); }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); save(); });
  const test = h('button', {}, t('Send test e-mail to me'));
  test.onclick = busy(test, async () => { try { const r = await api.call('sendTestEmail'); toast(t('Sent to {e}.', { e: r.sentTo })); } catch (err) { toast(err.message); } });
  mount(el, h('div', { class: 'card' }, form), h('div', { class: 'actions' }, test));
}

/** Generic list editor for small catalogs. */
function catalogEditor(el, { title, table, list, fields, describe, canEdit = true }) {
  const showArchived = { v: false };
  const listEl = h('div', { class: 'list' });
  const edit = async (rec) => {
    const res = await modal((close) => {
      const form = h('form', { onsubmit: (e) => { e.preventDefault(); close(formData(form)); } },
        h('h2', {}, rec.id ? t('Edit') : t('Add')), fields(rec),
        h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Save')), h('button', { type: 'button', onclick: () => close(null) }, t('Cancel'))));
      return form;
    });
    if (!res) return;
    try {
      const saved = await api.call('saveCatalog', { table, record: { ...res, id: rec.id, rev: rec.rev } });
      replaceIn(list, saved);
      toast(t('Saved.'));
      render();
    } catch (err) { toast(err.message); }
  };
  const toggleArchive = async (rec) => {
    try {
      const saved = rec.archived_at ? await api.call('restoreCatalog', { table, id: rec.id, rev: rec.rev })
        : await api.call('archiveCatalog', { table, id: rec.id, rev: rec.rev, reason: t('Archived in settings') });
      replaceIn(list, saved);
      render();
    } catch (err) { toast(err.message); }
  };
  const render = () => mount(listEl, list.filter((r) => showArchived.v || !r.archived_at)
    .sort((a, b) => (+a.sort || 0) - (+b.sort || 0) || a.name.localeCompare(b.name)).map((r) =>
      h('div', { class: 'item' }, h('div', { class: 'grow' }, h('div', { class: 'title' }, r.name), describe ? h('div', { class: 'sub' }, describe(r)) : null),
        r.archived_at ? h('span', { class: 'chip' }, t('Archived')) : null,
        canEdit ? [h('button', { class: 'link', onclick: () => edit(r) }, t('Edit')), h('button', { class: 'link', onclick: () => toggleArchive(r) }, r.archived_at ? t('Restore') : t('Archive'))] : null)));
  mount(el, h('div', { class: 'row between' }, h('h2', {}, title), canEdit ? h('button', { class: 'primary', onclick: () => edit({}) }, t('Add')) : null),
    h('label', { class: 'inline' }, h('input', { type: 'checkbox', onchange: (e) => { showArchived.v = e.target.checked; render(); } }), t('Show archived')),
    h('div', { class: 'card' }, listEl));
  render();
}

function settingsTypes(el) {
  const groupsEl = h('div', {});
  const typesEl = h('div', {});
  mount(el, h('p', { class: 'notice' }, t('Suggestions – not verified, not legal advice. The starting list only names typical obligations. '),
    t('It contains no intervals: you enter them for each obligation. Untick "Suggested" once you have checked a type.')), typesEl, groupsEl);
  catalogEditor(typesEl, {
    title: t('Obligation types'), table: 'ObligationTypes', list: state.obligationTypes,
    describe: (r) => [byId(state.obligationGroups, r.group_id)?.name, r.is_suggestion === 'true' ? t('Suggested – not verified') : '', r.description].filter(Boolean).join(' · '),
    fields: (r) => [field(t('Name'), h('input', { type: 'text', name: 'name', required: true, value: r.name || '' })),
      field(t('Group'), select('group_id', [{ value: '', label: '—' }, ...active(state.obligationGroups).map((g) => ({ value: g.id, label: g.name }))], r.group_id)),
      field(t('Description'), h('textarea', { name: 'description' }, r.description || '')),
      field(t('Sort order'), h('input', { type: 'number', name: 'sort', value: r.sort || '' })),
      h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'is_suggestion', checked: r.id ? r.is_suggestion === 'true' : false }), t('Suggested – not verified'))]
  });
  catalogEditor(groupsEl, {
    title: t('Groups'), table: 'ObligationGroups', list: state.obligationGroups,
    fields: (r) => [field(t('Name'), h('input', { type: 'text', name: 'name', required: true, value: r.name || '' })),
      field(t('Sort order'), h('input', { type: 'number', name: 'sort', value: r.sort || '' }))]
  });
}

function settingsKinds(el) {
  catalogEditor(el, {
    title: t('Object kinds'), table: 'ObjectKinds', list: state.objectKinds,
    fields: (r) => [field(t('Name'), h('input', { type: 'text', name: 'name', required: true, value: r.name || '' })),
      field(t('Sort order'), h('input', { type: 'number', name: 'sort', value: r.sort || '' }))]
  });
}

function settingsContractors(el) {
  catalogEditor(el, {
    title: t('Contractors'), table: 'Contractors', list: state.contractors,
    describe: (r) => [r.contact_person, r.phone, r.email].filter(Boolean).join(' · '),
    fields: (r) => [field(t('Name'), h('input', { type: 'text', name: 'name', required: true, value: r.name || '' })),
      field(t('Contact person'), h('input', { type: 'text', name: 'contact_person', value: r.contact_person || '' })),
      field(t('Phone'), h('input', { type: 'text', name: 'phone', value: r.phone || '' })),
      field(t('E-mail'), h('input', { type: 'email', name: 'email', value: r.email || '' })),
      field(t('Note'), h('textarea', { name: 'note' }, r.note || ''))]
  });
}

function settingsUsers(el) {
  const listEl = h('div', { class: 'list' });
  const edit = async (u) => {
    const res = await modal((close) => {
      const form = h('form', { onsubmit: (e) => { e.preventDefault(); close(formData(form)); } },
        h('h2', {}, u.id ? t('Edit user') : t('Add user')),
        field(t('Google e-mail'), h('input', { type: 'email', name: 'email', required: true, value: u.email || '' }), t('The user signs in with this Google account.')),
        field(t('Name'), h('input', { type: 'text', name: 'display_name', value: u.display_name || '' })),
        field(t('E-mail for notifications (optional)'), h('input', { type: 'email', name: 'notify_email', value: u.notify_email || '' }),
          t('E.g. a work address. Monthly e-mails, warnings and reminders go here; sign-in stays with the Google account.')),
        field(t('Role'), select('role', [{ value: 'User', label: t('User') }, { value: 'Admin', label: t('Administrator') }], u.role || 'User')),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', name: 'active', checked: u.id ? u.active === 'true' : true }), t('Active (may sign in)')),
        h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Save')), h('button', { type: 'button', onclick: () => close(null) }, t('Cancel'))));
      return form;
    });
    if (!res) return;
    try {
      const saved = await api.call('saveUser', { ...res, id: u.id, rev: u.rev });
      replaceIn(state.users, saved);
      toast(t('Saved.'));
      render();
    } catch (err) { toast(err.message); }
  };
  const render = () => mount(listEl, state.users.map((u) => h('div', { class: 'item' },
    h('div', { class: 'grow' }, h('div', { class: 'title' }, u.display_name || u.email), h('div', { class: 'sub' }, `${u.email}${u.notify_email ? ' → ' + u.notify_email : ''} · ${t(u.role)}`)),
    u.active === 'true' ? null : h('span', { class: 'chip' }, t('Inactive')), h('button', { class: 'link', onclick: () => edit(u) }, t('Edit')))));
  mount(el, h('div', { class: 'row between' }, h('h2', {}, t('Users')), h('button', { class: 'primary', onclick: () => edit({}) }, t('Add user'))),
    h('p', { class: 'muted small' }, t('Only these Google accounts can sign in to this organisation. Users are deactivated, never deleted.')),
    h('div', { class: 'card' }, listEl));
  render();
}

function settingsStorage(el) {
  if (state.settings.storage_enabled !== 'true') {
    return mount(el, h('div', { class: 'card' }, h('p', {}, t('Attachments of this organisation are stored by another deployment:')),
      h('p', {}, state.settings.storage_url || t('— not set —'))));
  }
  const listEl = h('div', { class: 'list' });
  const render = () => mount(listEl, state.storageClients.length ? state.storageClients.map((c) => h('div', { class: 'item' },
    h('div', { class: 'grow' }, h('div', { class: 'title' }, c.email), h('div', { class: 'sub' }, t('Folder: {f}', { f: c.org_label }))),
    h('button', { class: 'link', onclick: async () => {
      try { await api.call('archiveStorageClient', { id: c.id, reason: t('Removed in settings') }); state.storageClients = state.storageClients.filter((x) => x.id !== c.id); render(); } catch (err) { toast(err.message); }
    } }, t('Remove')))) : h('p', { class: 'muted' }, t('None.')));
  const form = h('form', {}, field(t('Google e-mail'), h('input', { type: 'email', name: 'email', required: true })),
    field(t('Folder name (their organisation)'), h('input', { type: 'text', name: 'org_label', required: true })),
    h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Allow'))));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try { const c = await api.call('saveStorageClient', formData(form)); state.storageClients.push(c); form.reset(); render(); } catch (err) { toast(err.message); }
  });
  mount(el, h('p', { class: 'muted' }, t('Attachments of this organisation are stored in the Drive of the account this deployment runs under. '),
    t('Users of other deployments listed here may store their attachments here too, each in their own folder.')),
  h('div', { class: 'card' }, h('h3', {}, t('Other deployments allowed to store attachments')), listEl), h('div', { class: 'card' }, form));
  render();
}

async function settingsStatus(el) {
  mount(el, h('p', { class: 'muted' }, t('Loading…')));
  const st = await api.call('status');
  const run = h('button', {}, t('Run daily check now'));
  run.onclick = busy(run, async () => {
    try { const r = await api.call('runDailyJob'); toast(t('Done. E-mails: monthly {m}, warnings {w}, reminders {r}, weekly {k}.', { m: r.monthly, w: r.warnings, r: r.reminders, k: r.weekly }) + (r.errors.length ? t(' Errors: {e}', { e: r.errors.join('; ') }) : '')); await reload(); route(); } catch (err) { toast(err.message); }
  });
  const install = h('button', {}, t('Install daily trigger'));
  install.onclick = busy(install, async () => { try { await api.call('installDailyTrigger'); toast(t('Installed.')); route(); } catch (err) { toast(err.message); } });
  mount(el, h('div', { class: 'card' }, h('dl', { class: 'kv' },
    h('dt', {}, t('Daily trigger')), h('dd', {}, st.triggerInstalled ? h('span', { class: 'chip ok' }, t('Installed')) : h('span', { class: 'chip overdue' }, t('Missing'))),
    h('dt', {}, t('Last daily check')), h('dd', {}, st.status.last_daily_run_at ? fmtDateTime(st.status.last_daily_run_at) : t('never')),
    h('dt', {}, t('Result')), h('dd', {}, st.status.last_daily_run_ok === 'true' ? 'OK' : (st.status.last_error || '—')),
    h('dt', {}, t('E-mail quota left today')), h('dd', {}, String(st.mailQuotaLeft)))),
  h('div', { class: 'actions' }, run, install),
  h('h2', {}, t('Recent e-mails')),
  h('div', { class: 'card' }, st.recentMail.length ? h('table', {}, h('tr', {}, h('th', {}, t('Sent')), h('th', {}, t('Kind ')), h('th', {}, t('To')), h('th', {}, t('Items')), h('th', {}, t('Result'))),
    st.recentMail.map((m) => h('tr', {}, h('td', {}, fmtDateTime(m.sent_at)), h('td', {}, m.kind), h('td', {}, m.recipient), h('td', {}, m.items),
      h('td', {}, m.ok === 'true' ? 'OK' : h('span', { class: 'error' }, m.error))))) : h('p', { class: 'muted' }, t('No e-mails sent yet.'))));
}

function settingsData(el) {
  const exp = h('button', { class: 'primary' }, t('Export all data'));
  exp.onclick = busy(exp, async () => {
    try {
      const r = await api.call('exportData');
      const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
      const a = h('a', { href: URL.createObjectURL(new Blob([bytes], { type: 'application/zip' })), download: r.fileName });
      document.body.append(a);
      a.click();
      a.remove();
      toast(t('Export downloaded.'));
    } catch (err) { toast(err.message); }
  });
  const file = h('input', { type: 'file', accept: 'application/json,.json' });
  const imp = h('button', {}, t('Import data.json'));
  imp.onclick = busy(imp, async () => {
    if (!file.files[0]) return toast(t('Choose data.json from an export first.'));
    try {
      const data = JSON.parse(await file.files[0].text());
      const r = await api.call('importData', { data });
      toast(t('Imported: {x}', { x: Object.entries(r.imported).map(([k, v]) => `${k} ${v}`).join(', ') }));
      await reload();
    } catch (err) { toast(err.message); }
  });
  mount(el, h('div', { class: 'card' }, h('h3', {}, t('Export')),
    h('p', {}, t('Downloads one ZIP file with every record of this organisation (archived records and logs included) as JSON and CSV, '),
      t('and a list of attachments with their Drive links. Keep it as a backup or to move to another deployment.')), exp),
  h('div', { class: 'card' }, h('h3', {}, t('Import')),
    h('p', {}, t('Imports data.json from an export into this organisation. Only possible while it has no objects and no obligations.')),
    file, h('div', { class: 'actions' }, imp)));
}

translateStatic();
start();
