#!/usr/bin/env node
'use strict';
/**
 * End-to-end check in a real browser (Chromium via Playwright) against the dev server
 * (real backend code on the in-memory Apps Script stand-in). Phone-sized viewport.
 *
 *   npm run build && node tools/dev-server.js 8787 &   then   node tests/e2e.js [screenshotDir]
 */
const path = require('path');
const assert = require('assert/strict');
const { execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = process.argv[2] || '';
const today = new Date().toISOString().slice(0, 10);
const nextYear = String(+today.slice(0, 4) + 1) + today.slice(4);
const dmy = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
  // Google's sign-in script is not used with dev sign-in (and is not reachable from the sandbox).
  await ctx.route('https://accounts.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); };
  const step = (s) => console.log('- ' + s);

  step('sign in and set up');
  await page.goto(BASE + '/');
  await page.fill('input[type=email]', 'owner@example.com');
  await page.click('text=Sign in (dev)');
  await page.waitForSelector('text=Set up Servisi');
  await shot('01-setup');
  await page.fill('input[name=orgName]', 'Demo organisation');
  await page.fill('input[name=displayName]', 'Owner');
  await page.click('button:has-text("Set up")');
  await page.waitForSelector('h1:has-text("Overview")');
  assert.match(await page.textContent('#banner'), /Daily check has not run yet/);
  await shot('02-overview-empty');

  step('add object');
  await page.click('.bottomnav >> text=Objects');
  await page.click('text=Add object');
  await page.fill('input[name=code]', 'K1');
  await page.fill('input[name=name]', 'Boiler room 1');
  await page.fill('input[name=address]', 'Main street 1');
  await page.selectOption('select[name=kind_id]', { index: 1 });
  await page.selectOption('select[name=responsible_user_id]', { index: 1 });
  await page.click('button:has-text("Save")');
  await page.waitForSelector('h1:has-text("K1 – Boiler room 1")');

  step('add obligation (yearly, from last completion, overdue)');
  await page.click('text=Add obligation');
  await page.selectOption('select[name=type_id]', { index: 1 });
  await page.check('input[name=count_from][value=completion]');
  await page.selectOption('select[name=rule_type]', 'leto');
  await page.fill('input[name=start_date]', '2026-01-15');
  await page.waitForSelector('.notice:has-text("Due dates: 15.01.2026")');
  await shot('03-obligation-form');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Next due');
  assert.equal((await page.textContent('.due')).trim(), '15.01.2026');
  assert.ok(await page.isVisible('.chip.overdue'));

  step('add second obligation (quarterly by calendar) and an incomplete one');
  await page.click('a:has-text("K1 – Boiler room 1")');
  await page.click('text=Add obligation');
  await page.selectOption('select[name=type_id]', { index: 2 });
  await page.selectOption('select[name=rule_type]', 'cetrtletje');
  await page.fill('input[name=rule_day]', '10');
  for (const m of ['1', '4', '7', '10']) await page.check(`input[name=rule_months][value="${m}"]`);
  await page.fill('input[name=start_date]', today);
  await page.fill('input[name=warn_days_before]', '14');
  await page.fill('textarea[name=recipient_emails]', 'contractor@example.com');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Quarterly on the 10th of Jan, Apr, Jul, Oct, by calendar');
  await page.click('a:has-text("K1 – Boiler room 1")');
  await page.click('text=Add obligation');
  await page.selectOption('select[name=type_id]', { index: 3 });
  await page.selectOption('select[name=rule_type]', 'leto');
  await page.click('button:has-text("Save")');
  await page.waitForSelector('text=Repeat settings are incomplete');

  step('overview groups by object');
  await page.click('.bottomnav >> text=Overview');
  await page.waitForSelector('.group-title:has-text("K1 – Boiler room 1")');
  await shot('04-overview');
  await page.click('.tab:has-text("Needs attention")');
  await page.waitForSelector('text=Incomplete repeat settings');

  step('mark done with a large photo from "camera"');
  await page.click('.tab:has-text("Overdue")');
  await page.click('.item:has-text("15.01.2026")');
  await page.click('text=Mark done');
  await page.waitForSelector(`.notice:has-text("Next due: ${dmy(nextYear)}")`);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 4000; c.height = 3000;
    const g = c.getContext('2d');
    const img = g.createImageData(4000, 3000);
    for (let i = 0; i < img.data.length; i += 4) {
      const x = (i / 4) % 4000;
      img.data[i] = (x * 7) % 255; img.data[i + 1] = (i * 13) % 255; img.data[i + 2] = (x ^ (i / 4000)) % 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  const original = Buffer.from(png, 'base64');
  await page.setInputFiles('input[type=file][capture]', { name: 'photo.png', mimeType: 'image/png', buffer: original });
  await page.fill('textarea[name=note]', 'Checked, all fine.');
  await shot('05-mark-done');
  await page.click('button:has-text("Save as done")');
  await page.waitForSelector(`.due:has-text("${dmy(nextYear)}")`, { timeout: 30000 });
  await page.waitForSelector('text=Photo: ');
  const histText = await page.textContent('main');
  assert.match(histText, /Done \d\d\.\d\d\.\d{4}/);
  assert.match(histText, /closed due 15\.01\.2026/);
  const sizeMatch = /Photo: [^()]+\((\d+) kB\)/.exec(histText);
  console.log(`  original PNG ${(original.length / 1024).toFixed(0)} kB -> stored ${sizeMatch ? sizeMatch[1] + ' kB' : '?'} (synthetic noise image, not a real photo)`);
  await shot('06-obligation-after');

  step('remind me');
  await page.click('button:has-text("Remind me")');
  await page.fill('dialog input[name=days]', '3');
  await page.fill('dialog textarea[name=note]', 'Call contractor');
  await page.click('dialog button:has-text("Set reminder")');
  await page.waitForSelector('text=Cancel reminder');

  step('void completion restores the due date');
  page.once('dialog', () => {});
  await page.click('button.link:has-text("Void")');
  await page.fill('dialog textarea', 'Entered on the wrong obligation');
  await page.click('dialog button:has-text("Confirm")');
  await page.waitForSelector('text=Voided');
  await page.goto(page.url()); // reload view
  await page.waitForSelector('.due:has-text("15.01.2026")');

  step('settings pages render');
  await page.click('.bottomnav >> text=Settings');
  for (const tab of ['Notifications', 'Users', 'Obligation types', 'Contractors', 'Object kinds', 'Storage', 'Status', 'Export / import']) {
    await page.click(`.tab:has-text("${tab}")`);
    await page.waitForTimeout(150);
    assert.ok(!(await page.isVisible('text=Something went wrong')), tab);
  }
  await page.click('.tab:has-text("Obligation types")');
  await page.waitForSelector('text=Suggestions – not verified');
  await shot('07-settings-types');

  step('daily job sends e-mails; banner disappears');
  await page.request.get(BASE + '/__dev/daily');
  const mails = await (await page.request.get(BASE + '/__dev/mails')).json();
  const monthly = mails.find((m) => m.to === 'owner@example.com' && /Obligations for/.test(m.subject));
  assert.ok(monthly, 'monthly e-mail sent');
  assert.match(monthly.body, /Overdue \(1\)/);
  assert.match(monthly.body, /Incomplete setup/);
  await page.click('.tab:has-text("Status")');
  await page.waitForSelector('text=Recent e-mails');
  await page.goto(BASE + '/#/');
  await page.reload();
  await page.waitForSelector('h1:has-text("Overview")');
  assert.equal(await page.isVisible('#banner'), false, 'banner: ' + (await page.textContent('#banner')));
  await shot('08-overview-after-daily');

  step('export downloads a zip');
  await page.goto(BASE + '/#/settings/data');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Export all data")')]);
  assert.match(dl.suggestedFilename(), /^servisi-export-\d{4}-\d{2}-\d{2}\.zip$/);

  step('archive object hides it and its obligations');
  await page.goto(BASE + '/#/objects');
  await page.click('.item:has-text("K1")');
  await page.click('button:has-text("Archive")');
  await page.fill('dialog textarea', 'Test');
  await page.click('dialog button:has-text("Confirm")');
  await page.waitForSelector('text=Archived');
  await page.goto(BASE + '/#/');
  await page.waitForSelector('text=Nothing here.');

  assert.deepEqual(errors, [], 'no browser errors');
  console.log('E2E OK');
  await browser.close();
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1); });
