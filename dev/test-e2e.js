// Browser test: drives index.html against the mock backend with Playwright. Run: node dev/test-e2e.js
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const { start } = require('./server');
const shots = path.join(__dirname, 'screenshots');

(async () => {
  const { server } = await start(8799);
  const browser = await chromium.launch();
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Duplicate entry, test' : undefined));
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

  await page.goto('http://localhost:8799/');
  ok(await page.isVisible('#urlIn'), 'asks for the Sheet link when there is none');
  await page.screenshot({ path: path.join(shots, '00-lock.png') });
  await page.fill('#urlIn', 'http://localhost:8799/api');
  await page.fill('#pinIn', '0000'); await page.click('#lockBtn');
  await page.waitForFunction(() => /Wrong/.test(document.getElementById('lockMsg').textContent));
  ok(true, 'wrong passcode shown');
  await page.fill('#pinIn', '1234'); await page.click('#lockBtn');
  await page.waitForSelector('#app:not(.hidden)');
  ok(await page.textContent('#tInv') === '29', 'home count');
  const late = +await page.textContent('#tLate');
  ok(late === 12, 'overdue / never done = 12 scheduled units without PM, got ' + late);
  await page.screenshot({ path: path.join(shots, '01-home.png'), fullPage: true });

  // inventory
  await page.click('nav.tabs button[data-v="inv"]');
  await page.fill('#iQ', 'cash');
  ok(await page.locator('#iTable tbody tr').count() === 6, 'search by office');
  await page.fill('#iQ', '');
  await page.screenshot({ path: path.join(shots, '02-inventory.png') });
  await page.click('#addEq');
  await page.selectOption('#eType', 'Laptop');
  ok(await page.inputValue('#eFreq') === 'Quarterly', 'default frequency follows type');
  await page.fill('#eBrand', 'Lenovo ThinkPad E14'); await page.fill('#eSerial', 'PF3XYZ01'); await page.fill('#eTag', 'TRC-ICT-2026-015');
  await page.fill('#eOffice', 'Office of the TRC Chief'); await page.fill('#eEndUser', 'Kimberly Cajano'); await page.fill('#eAcq', '2026-03-02');
  await page.screenshot({ path: path.join(shots, '03-add-equipment.png') });
  await page.click('#eqSave');
  await page.waitForFunction(() => /Added as ICT-0030/.test(document.getElementById('eqMsg').textContent));
  ok(true, 'equipment added');
  await page.click('#eqPmBtn');

  // do PM
  await page.waitForSelector('#pmBody:not(.hidden)');
  ok(/ICT-0030/.test(await page.textContent('#pmSelT')), 'PM opened for the new unit');
  ok(await page.isVisible('.ck[data-k="p6"]'), 'laptop battery item shown');
  ok(!(await page.isVisible('.ck[data-k="r1"]')), 'printer items hidden for a laptop');
  await page.click('#ckAll');
  await page.click('.ck[data-k="p5"] .seg button[data-v="Issue"]');
  await page.fill('.ck[data-k="p5"] .note', 'fan is noisy');
  await page.click('.ck[data-k="b3"] .seg button[data-v="N/A"]');
  ok(await page.isVisible('#issueList'), 'issues summary shows');
  await page.fill('#pOsLic', 'Licensed / activated'); await page.fill('#pMso', 'Microsoft Office 2021');
  await page.fill('#pAction', 'Cleaned the fan and vents. Applied updates.');
  await page.check('input[name="ov"][value="Functional, for monitoring"]');
  const pd = await page.inputValue('#pDate'), pn = await page.inputValue('#pNext'); console.log('date', pd, 'next', pn); ok(pn && pn > pd, 'next PM auto from date + frequency');
  await page.selectOption('#pBy', 'Argie R. Lopez');
  await page.locator('#pad').scrollIntoViewIfNeeded();
  const box = await page.locator('#pad').boundingBox();
  await page.mouse.move(box.x + 40, box.y + 100); await page.mouse.down();
  for (let i = 0; i < 20; i++) await page.mouse.move(box.x + 40 + i * 12, box.y + 100 + Math.sin(i) * 25);
  await page.mouse.up();
  await page.screenshot({ path: path.join(shots, '04-do-pm.png'), fullPage: true });
  await page.click('#pmSave');
  await page.waitForSelector('#pmDone:not(.hidden)');
  ok(/PM-2026-002/.test(await page.textContent('#pmDoneT')), 'saved with next ref');
  await page.click('#pmDonePrint');
  await page.waitForFunction(() => window.__printed === 1); ok(true, 'print called');
  const formHtml = await page.innerHTML('#printArea');
  ok(/PM-2026-002/.test(formHtml) && /fan is noisy/.test(formHtml) && /COH-IDN-F-02/.test(formHtml), 'filled form content');
  ok(/<img src="data:image\/png/.test(formHtml.split('ACKNOWLEDGED')[1] || ''), 'signature on form');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-pm-form.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  const pages = await page.evaluate(() => { const el = document.querySelector('#printArea .sheet'); return el.getBoundingClientRect().height; });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => document.body.classList.remove('printing'));
  console.log('form height px', Math.round(pages));

  // records
  await page.click('nav.tabs button[data-v="recs"]');
  ok(await page.locator('#rTable tbody tr').count() === 2, 'two records');
  await page.click('#rTable tbody tr[data-r="PM-2026-001"]');
  await page.waitForSelector('#pmDlg[open]');
  await page.screenshot({ path: path.join(shots, '05-record.png') });
  await page.click('#pmPrint');
  await page.waitForFunction(() => window.__printed === 2);
  ok(/Waste ink pad counter/.test(await page.innerHTML('#printArea')), 'old record prints');
  await page.click('#pmVoid');
  await page.waitForFunction(() => !document.getElementById('pmDlg').open);
  await page.waitForFunction(() => document.querySelectorAll('#rTable tbody tr').length === 1);
  ok(true, 'void hides record');

  // schedule
  await page.click('nav.tabs button[data-v="sched"]');
  const rows = await page.locator('#sTable tbody tr').count();
  ok(rows === 14, 'scheduled units in schedule: ' + rows);
  ok(await page.locator('#sTable .mk.done').count() >= 1, 'done mark shown');
  await page.screenshot({ path: path.join(shots, '06-schedule.png') });
  await page.click('#sPrint');
  ok(/PREVENTIVE MAINTENANCE SCHEDULE, CY 2026/.test(await page.innerHTML('#printArea')), 'schedule print');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-schedule.pdf'), format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));

  // reports
  await page.click('nav.tabs button[data-v="reports"]');
  await page.fill('#qRec', 'Replace the noisy fan of ICT-0030 if it gets worse.');
  await page.click('#qPrint');
  const rep = await page.innerHTML('#printArea');
  ok(/PREVENTIVE MAINTENANCE REPORT/.test(rep) && /PM-2026-002/.test(rep) && !/PM-2026-001/.test(rep), 'quarter report lists valid PMs only');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-quarterly-report.pdf'), format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  await page.click('#blankForm');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'blank-pm-form.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto('http://localhost:8799/');
  await phone.fill('#urlIn', 'http://localhost:8799/api'); await phone.fill('#pinIn', '1234'); await phone.click('#lockBtn');
  await phone.waitForSelector('#app:not(.hidden)');
  await phone.screenshot({ path: path.join(shots, '07-phone-home.png'), fullPage: true });
  await phone.click('#homeDue [data-pm]');
  await phone.waitForSelector('#pmBody:not(.hidden)');
  await phone.screenshot({ path: path.join(shots, '08-phone-pm.png'), fullPage: true });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, 'no sideways scroll on phone');

  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  console.log('e2e: ' + n + ' checks passed');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
