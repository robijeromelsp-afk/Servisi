// Small DOM helpers. All text goes through textContent, never innerHTML.
import { t } from './i18n.js';

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function mount(el, ...children) {
  el.replaceChildren();
  append(el, children);
}

let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/** 2027-05-15 -> 15.05.2027 */
export function fmtDate(d) {
  return d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '';
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function field(label, input, hint) {
  return h('div', { class: 'field' }, h('label', {}, label), input, hint ? h('div', { class: 'hint' }, hint) : null);
}

export function select(name, options, value, attrs = {}) {
  return h('select', { name, ...attrs },
    options.map((o) => (o.group
      ? h('optgroup', { label: o.group }, o.options.map((x) => h('option', { value: x.value, selected: x.value === value }, x.label)))
      : h('option', { value: o.value, selected: String(o.value) === String(value ?? '') }, o.label))));
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi) {
        out[el.name] = out[el.name] || [];
        if (el.checked) out[el.name].push(el.value);
      } else out[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) out[el.name] = el.value;
    } else out[el.name] = el.value;
  }
  return out;
}

/** Simple modal; resolves with the value passed to close, or null when dismissed. */
export function modal(build) {
  return new Promise((resolve) => {
    const dlg = h('dialog', {});
    const close = (v) => { dlg.close(); dlg.remove(); resolve(v ?? null); };
    mount(dlg, build(close));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function askReason(title, label) {
  label = label || t('Reason');
  return modal((close) => {
    const input = h('textarea', { name: 'reason', required: true });
    const form = h('form', { onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) close(input.value.trim()); } },
      h('h2', {}, title), field(label, input),
      h('div', { class: 'actions' }, h('button', { class: 'primary', type: 'submit' }, t('Confirm')),
        h('button', { type: 'button', onclick: () => close(null) }, t('Cancel'))));
    setTimeout(() => input.focus(), 50);
    return form;
  });
}

export function busy(button, fn) {
  return async (...args) => {
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = t('Working…');
    try {
      return await fn(...args);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };
}
