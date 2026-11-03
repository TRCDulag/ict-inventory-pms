// Browser test: drives index.html against the mock backend with Playwright. Run: node dev/test-e2e.js
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const { start } = require('./server');
const shots = path.join(__dirname, 'screenshots');

(async () => {
  const { server, be } = await start(8799);
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
  ok(await page.isVisible('#lockReq') && await page.isHidden('#lock .privacy') && await page.isVisible('#privLink'), 'sign-in card offers the request page; privacy notice is a link, not laid out');
  await page.screenshot({ path: path.join(shots, '00-lock.png') });
  await page.click('#privLink');
  ok(await page.isVisible('#privDlg') && /RA 10173/.test(await page.textContent('#privDlg')), 'privacy notice opens as a pop-up');
  await page.click('#privDlg .df [data-close]');
  // no accounts yet: entering the Sheet link brings up the first-account setup
  await page.fill('#urlIn', 'http://localhost:8799/api'); await page.press('#urlIn', 'Tab');
  await page.waitForSelector('#setupForm:not(.hidden)');
  ok(true, 'first-time setup shown');
  await page.fill('#suPin', '0000'); await page.fill('#suName', 'James Adrian M. Elona'); await page.fill('#suUser', 'jelona'); await page.fill('#suPw', 'ictu2026x');
  await page.screenshot({ path: path.join(shots, '00b-setup.png') });
  await page.click('#suBtn');
  await page.waitForFunction(() => /passcode/i.test(document.getElementById('suMsg').textContent));
  ok(true, 'wrong setup passcode shown');
  await page.fill('#suPin', '1234'); await page.click('#suBtn');
  await page.waitForSelector('#app:not(.hidden)');
  ok(await page.textContent('#meName2') === 'James Adrian M. Elona' && await page.isVisible('nav.tabs button[data-v="acc"]'), 'signed in as the Head, Accounts shown');
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
  // picking an employee sets the section; changing the employee changes it again; the last line of a list adds a new one
  await page.fill('#eOffice', '');
  await page.fill('#eEndUser', 'ana liza m garcia'); await page.press('#eEndUser', 'Tab');
  ok(await page.inputValue('#eEndUser') === 'Ana Liza M. Garcia' && await page.inputValue('#eOffice') === 'Accounting Section', 'typed masterlist name sets the section');
  await page.fill('#eEndUser', 'santos');
  ok(await page.isVisible('#eEndUserList'), 'employee list opens while typing');
  await page.screenshot({ path: path.join(shots, '10-employee-list.png') });
  await page.press('#eEndUser', 'Enter');
  { const eu = await page.inputValue('#eEndUser'), eo = await page.inputValue('#eOffice'); ok(eu === 'Maria Clara R. Santos' && eo === 'Budget Section', 'changing the employee changes the section: ' + eu + ' / ' + eo); }
  await page.fill('#eAcc', 'Kimberly Cajano');
  ok(/Add "Kimberly Cajano" as a new employee/.test(await page.textContent('#eAccList .opt.add')), 'unknown name offers add at the bottom of the list');
  await page.click('#eAccList .opt.add');
  await page.waitForSelector('#empDlg[open]');
  ok(await page.inputValue('#emName') === 'Kimberly Cajano', 'name carried into Add employee');
  await page.fill('#emPos', 'Administrative Assistant'); await page.fill('#emOffice', 'office of the trc chief'); await page.press('#emOffice', 'Tab');
  await page.screenshot({ path: path.join(shots, '09-add-employee.png') });
  await page.click('#empSave');
  await page.waitForFunction(() => !document.getElementById('empDlg').open);
  ok(await page.inputValue('#eAcc') === 'Kimberly Cajano', 'new employee picked');
  await page.fill('#eOffice', 'Motor Pool');
  await page.click('#eOfficeList .opt.add');
  await page.waitForSelector('#offDlg[open]');
  ok(await page.inputValue('#oName') === 'Motor Pool', 'typed section carried into Add section');
  await page.click('#offSave');
  await page.waitForFunction(() => !document.getElementById('offDlg').open);
  ok(await page.inputValue('#eOffice') === 'Motor Pool', 'new section picked');
  await page.fill('#eEndUser', 'Kimberly Cajano'); await page.press('#eEndUser', 'Tab');
  ok(await page.inputValue('#eOffice') === 'Office of the TRC Chief', 'added employee sets the section too');
  await page.fill('#eAcq', '2026-03-02');
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
  // sort, then a calendar page for each section
  await page.selectOption('#sSort', 'next');
  ok(await page.$eval('#sTable tbody tr td b', b => b.textContent) !== 'ICT-0029', 'sort by next PM puts the done unit last');
  await page.selectOption('#sSort', 'office');
  await page.click('#sPrintSec');
  const secs = await page.evaluate(() => [...new Set(schedRows().map(i => i.office))].length);
  ok(await page.locator('#printArea .sheet.cal').count() === secs && await page.locator('#printArea .sheet.cal').first().locator('.cm').count() === 12, 'one 12-month calendar page per section: ' + secs);
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-schedule-by-section.pdf'), format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true });
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

  // header menu
  await page.click('#menuBtn');
  ok(await page.isVisible('#menuPanel') && /Sign out/.test(await page.textContent('#lockOut')) && /Head/.test(await page.textContent('#meRole')), 'menu shows the person, Refresh and Sign out');
  await page.screenshot({ path: path.join(shots, '11-menu.png') });
  await page.click('#reloadBtn');
  ok(await page.isHidden('#menuPanel'), 'menu closes');

  // job orders
  await page.click('nav.tabs button[data-v="jo"]');
  await page.click('#newJo');
  await page.waitForSelector('#joDlg[open]');
  await page.fill('#jName', 'maria clara');
  await page.press('#jName', 'Enter');
  ok(await page.inputValue('#jUnit') === 'Budget Section' && await page.inputValue('#jPos') === 'Budget Officer II', 'requestor sets section and position');
  ok(await page.isHidden('#jEquip') && await page.isHidden('#jLoc') && await page.isHidden('#jHead'), 'a new job order hides the equipment fields until a type is picked');
  await page.check('#jt3_1');
  ok(await page.isHidden('#jEquip') && await page.isHidden('#jLoc') && await page.isHidden('#jConsent'), 'ID printing asks nothing about equipment or location');
  await page.uncheck('#jt3_1'); await page.check('#jt0_0');
  ok(await page.isVisible('#jEquip') && await page.isVisible('#jLoc') && await page.isVisible('#jConsent'), 'a hardware request shows the equipment fields');
  await page.fill('#jEq', 'ICT-0001'); await page.press('#jEq', 'Escape'); await page.press('#jEq', 'Tab');
  ok(await page.inputValue('#jEquip') === 'Desktop Computer' && /MSI/.test(await page.inputValue('#jModel')), 'equipment code fills the equipment');
  await page.fill('#jDesc', 'Computer restarts by itself.');
  await page.click('#joSave');
  await page.waitForFunction(() => /Logged as ICTU-\d{4}-0001/.test(document.getElementById('joMsg').textContent));
  ok(true, 'job order logged');
  await page.selectOption('#jPriority', 'P2 - High'); await page.selectOption('#jStatus', 'In Progress'); await page.selectOption('#jBy', 'Argie R. Lopez');
  await page.fill('#jFind', 'Loose RAM'); await page.screenshot({ path: path.join(shots, '12-job-order.png') });
  await page.click('#joSave');
  await page.waitForFunction(() => document.getElementById('joMsg').textContent === 'Saved.');
  ok(/Status set to In Progress/.test(await page.textContent('#joHist')), 'job order history');
  await page.click('#joPrint');
  const joHtml = await page.innerHTML('#printArea');
  ok(/COH-IDN-F-01/.test(joHtml) && /ICTU-\d{4}-0001/.test(joHtml) && /Loose RAM/.test(joHtml) && /SANTOS/.test(joHtml), 'job order form filled');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-job-order.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  const joH = await page.evaluate(() => document.querySelector('#printArea .sheet').getBoundingClientRect().height);
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  console.log('JO form height px', Math.round(joH));
  await page.click('#joDlg [data-close]');
  ok(await page.locator('#jTable tbody tr').count() === 1 && +await page.textContent('#navJo') === 1, 'open job order listed and counted');
  await page.screenshot({ path: path.join(shots, '13-job-orders.png') });

  // equipment history and QR labels
  await page.click('nav.tabs button[data-v="inv"]');
  await page.click('#iTable tbody tr[data-id="ICT-0001"]');
  await page.waitForSelector('#eqDlg[open]');
  ok(/ICTU-\d{4}-0001/.test(await page.textContent('#eqView')), 'job order in the service history');
  await page.screenshot({ path: path.join(shots, '14-equipment-history.png') });
  await page.click('#eqQrBtn');
  ok(await page.locator('#printArea .lbl-card svg').count() === 1, 'one QR label');
  await page.click('#eqDlg .x');
  await page.selectOption('#iOffice', 'Cash Unit');
  await page.click('#iLabels');
  const nLabels = await page.locator('#printArea .lbl-card').count();
  ok(nLabels === await page.locator('#iTable tbody tr').count(), 'labels for the filtered list: ' + nLabels);
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-qr-labels.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  await page.selectOption('#iOffice', '');
  ok(await page.evaluate(() => { const b = document.getElementById('addEq').getBoundingClientRect(), t = document.querySelector('#iTable thead').getBoundingClientRect(); return b.height > 0 && b.bottom <= t.top + 1; }), 'add equipment sits at the top of the list');
  // what's new
  await page.click('#menuBtn'); await page.click('#mNew');
  ok(await page.isVisible('#newDlg') && (await page.textContent('#newBody h4')).includes(await page.evaluate(() => APP_VERSION)), "What's new lists this version first");
  await page.click('#newDlg .df [data-close]');
  // column sorting
  const firstId = () => page.$eval('#iTable tbody tr', tr => tr.dataset.id);
  await page.click('.sortb[data-s="id"]');
  ok(await firstId() === await page.evaluate(() => D.inventory.map(i => i.id).filter(id => active(byId(id))).sort().pop()), 'ID sorts high to low on a second click, got ' + await firstId());
  await page.click('.sortb[data-s="brand"]');
  const brands = await page.$$eval('#iTable tbody tr td:nth-child(2)', t => t.map(x => x.childNodes[0].textContent.trim().toLowerCase()));
  ok(brands.every((v, i) => !i || brands[i - 1].localeCompare(v) <= 0), 'equipment sorts A to Z');
  await page.click('.sortb[data-s="next"]');
  ok(/No PM yet|Overdue/.test(await page.textContent('#iTable tbody tr td:last-child')), 'next PM puts the overdue first');
  await page.click('.sortb[data-s="id"]');
  ok(await firstId() === 'ICT-0001', 'back to ID order');
  ok(await page.evaluate(() => { const w = document.querySelector('#v-inv .tablewrap'); return w.scrollHeight > w.clientHeight && getComputedStyle(w).overflowY === 'auto'; }), 'the masterlist scrolls inside its box');

  // a photo of the property sticker fills the form (Gemini stand-in in the mock)
  be.gas._props.GEMINI_API_KEY = 'test-key';
  await page.click('#addEq'); await page.waitForSelector('#eqDlg[open]');
  await page.setInputFiles('#eStkFile', path.join(__dirname, 'fixtures', 'sticker-sample.jpg'));
  await page.waitForFunction(() => /Filled in/.test(document.getElementById('eStkMsg').textContent));
  const stk = await page.evaluate(() => ['eType', 'eBrand', 'eTag', 'eSource', 'eAcc', 'eCost'].map(id => document.getElementById(id).value));
  ok(stk.join('|') === 'Laptop|Lenovo|SEICT-HV-25-11-102|ICS 2025-11-212|James Adrian M. Elona|45500', 'sticker photo fills the form: ' + stk.join('|'));
  await page.screenshot({ path: path.join(shots, '25-sticker.png') });
  await page.click('#eqDlg .dh [data-close]');

  // scan or type a code
  await page.click('#scanBtn');
  await page.waitForSelector('#scanDlg[open]');
  await page.fill('#scanCode', 'ict 5'); await page.press('#scanCode', 'Enter');
  await page.waitForSelector('#eqDlg[open]');
  ok(/ICT-0005/.test(await page.textContent('#eqTitle')), 'typed code opens the unit');
  await page.click('#eqDlg .x');

  // monthly JO report
  await page.click('nav.tabs button[data-v="reports"]');
  await page.click('#mrPrint');
  ok(/MONTHLY ICTU JOB ORDER REPORT/.test(await page.innerHTML('#printArea')), 'monthly JO report');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-monthly-jo-report.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  await page.click('nav.tabs button[data-v="jo"]'); await page.click('#jPoster');
  ok(/Need ICT help/.test(await page.innerHTML('#printArea')), 'request poster');


  // ---------- 1.3.0: TIR, CSM link, transfers, stock, network, incidents, accounts, dashboard ----------
  await page.click('nav.tabs button[data-v="jo"]');
  await page.click('#jShow'); await page.selectOption('#jShow', '');
  await page.click('#jTable tbody tr >> nth=0');
  await page.waitForSelector('#joDlg[open]');
  await page.selectOption('#jTirRec', 'Repair with parts to be procured'); await page.fill('#jTirCost', '2500');
  await page.selectOption('#jStatus', 'Resolved'); await page.fill('#jAction', 'Reseated the RAM.');
  await page.click('#joSave');
  await page.waitForFunction(() => /TIR No\. TIR-\d{4}-001/.test(document.getElementById('jTirNo').textContent));
  ok(await page.isVisible('#joCsm .csmlink svg') && /Ask the requestor to rate/.test(await page.textContent('#joCsm')), 'closed JO shows the rating QR and link');
  await page.screenshot({ path: path.join(shots, '17-jo-tir-csm.png') });
  const csmLink = await page.getAttribute('#joCsm a', 'href');
  await page.click('#joTir');
  const tir = await page.innerHTML('#printArea');
  ok(/TECHNICAL INSPECTION REPORT/.test(tir) && /TIR-\d{4}-001/.test(tir) && /PHP 2,500\.00/.test(tir), 'TIR prints');
  await page.evaluate(() => document.body.classList.add('printing')); await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-tir.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  await page.click('#joPrint');
  ok(await page.locator('#printArea .rateqr svg').count() === 1, 'JO form carries the rating QR');
  await page.click('#joDlg [data-close]');

  // the requestor rates on a phone
  const rater = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  rater.on('pageerror', e => errors.push(e.message));
  await rater.addInitScript(() => localStorage.setItem('pms.gsUrl', 'http://localhost:8799/api'));
  await rater.goto(csmLink.replace('https://trcdulag.github.io/ict-inventory-pms/', 'http://localhost:8799/'));
  await rater.waitForSelector('#rateForm');
  ok(!/Elona|Lopez/.test(await rater.textContent('#pubTrack')), 'track page shows no staff names');
  await rater.click('input[name="speed"][value="Very Satisfied"]'); await rater.click('input[name="quality"][value="Satisfied"]'); await rater.click('input[name="courtesy"][value="Very Satisfied"]');
  await rater.screenshot({ path: path.join(shots, '18-rate-phone.png'), fullPage: true });
  await rater.click('#rateSend');
  await rater.waitForFunction(() => /Thank you for your feedback/.test(document.getElementById('rateBox').textContent));
  ok(true, 'requestor rated the service');
  await rater.close();

  // transfer from the equipment window
  await page.click('nav.tabs button[data-v="inv"]');
  await page.click('#iTable tbody tr[data-id="ICT-0002"]');
  await page.waitForSelector('#eqDlg[open]');
  await page.click('#eqTrBtn');
  await page.waitForSelector('#trDlg[open]');
  ok(/Now with/.test(await page.textContent('#trNow')), 'transfer shows where the unit is now');
  await page.selectOption('#trKind', 'Transfer to another section');
  await page.fill('#trUser', 'maria clara'); await page.press('#trUser', 'Enter');
  ok(await page.inputValue('#trOffice') === 'Budget Section', 'new end user sets the new section');
  await page.fill('#trOfficer', 'Maria Clara R. Santos'); await page.press('#trOfficer', 'Escape'); await page.fill('#trDoc', 'ICS 2026-10-015');
  await page.screenshot({ path: path.join(shots, '19-transfer.png') });
  await page.click('#trSave');
  await page.waitForFunction(() => /Saved as TR-\d{4}-001/.test(document.getElementById('trMsg').textContent));
  await page.click('#trPrint');
  ok(/TRANSFER \/ TURNOVER SLIP/.test(await page.innerHTML('#printArea')) && /ICS 2026-10-015/.test(await page.innerHTML('#printArea')), 'transfer slip prints');
  await page.click('#trDlg [data-close]');
  await page.click('#iTable tbody tr[data-id="ICT-0002"]');
  ok(/Budget Section/.test(await page.textContent('#eqView')) && /TR-\d{4}-001/.test(await page.textContent('#eqView')), 'masterlist and history follow the transfer');
  await page.click('#eqDlg .x');

  // spare parts
  await page.click('nav.tabs button[data-v="stock"]');
  await page.click('#addStock'); await page.waitForSelector('#kDlg[open]');
  await page.fill('#kItem', 'DDR4 8GB RAM'); await page.fill('#kCatIn', 'Computer parts'); await page.fill('#kUnit', 'piece'); await page.fill('#kReorder', '2'); await page.fill('#kCost', '1500');
  await page.click('#kSave');
  await page.waitForFunction(() => /Added as SP-001/.test(document.getElementById('kMsg').textContent));
  await page.click('#kDlg .x');
  await page.click('#kTable tbody tr[data-k="SP-001"] [data-mv="Received"]');
  await page.fill('#mQty', '3'); await page.click('#mSave');
  await page.waitForFunction(() => !document.getElementById('mDlg').open);
  await page.click('#kTable tbody tr[data-k="SP-001"] [data-mv="Issued"]');
  await page.fill('#mQty', '2'); await page.fill('#mEq', 'ICT-0001'); await page.press('#mEq', 'Escape'); await page.fill('#mRef', 'ICTU-2026-0001');
  await page.click('#mSave');
  await page.waitForFunction(() => !document.getElementById('mDlg').open);
  ok(/1/.test(await page.textContent('#kTable tbody tr[data-k="SP-001"] td:nth-child(3)')) && /Low/.test(await page.textContent('#kTable tbody tr[data-k="SP-001"]')), 'balance 1 and flagged low');
  await page.screenshot({ path: path.join(shots, '20-stock.png'), fullPage: true });
  await page.click('nav.tabs button[data-v="inv"]'); await page.click('#iTable tbody tr[data-id="ICT-0001"]');
  ok(/PHP 3,000\.00/.test(await page.textContent('#eqView')), 'parts issued count toward the unit cost');
  await page.click('#eqDlg .x');

  // network
  await page.click('nav.tabs button[data-v="net"]');
  await page.click('#addNet'); await page.waitForSelector('#nDlg[open]');
  await page.selectOption('#nKindIn', 'Router'); await page.fill('#nName', 'Main router'); await page.fill('#nIp', '192.168.1.1'); await page.fill('#nMac', '001a2b3c4d5e');
  await page.click('#nSave');
  await page.waitForFunction(() => /Added as NET-001/.test(document.getElementById('nMsg').textContent));
  await page.click('#nDlg .x');
  await page.click('#addNet'); await page.selectOption('#nKindIn', 'Switch'); await page.fill('#nName', 'Second switch'); await page.fill('#nIp', '192.168.1.1');
  await page.click('#nSave');
  await page.waitForFunction(() => /already used by NET-001/.test(document.getElementById('nMsg').textContent));
  ok(true, 'duplicate IP refused');
  await page.click('#nDlg .x');
  ok(/00:1A:2B:3C:4D:5E/.test(await page.textContent('#nTable')), 'network list shows the item');
  await page.screenshot({ path: path.join(shots, '21-network.png') });

  // incident with personal data: 72-hour clock
  await page.click('nav.tabs button[data-v="inc"]');
  await page.click('#newInc'); await page.waitForSelector('#xDlg[open]');
  await page.selectOption('#xType', 'Lost or stolen device'); await page.selectOption('#xPd', 'Yes'); await page.selectOption('#xSev', 'High');
  await page.fill('#xDesc', 'Office laptop left in a tricycle.');
  await page.click('#xSave');
  await page.waitForFunction(() => /Recorded as INC-\d{4}-001/.test(document.getElementById('xMsg').textContent));
  ok(/72-hour/.test(await page.textContent('#xClock')), 'NPC 72-hour clock shown');
  await page.screenshot({ path: path.join(shots, '22-incident.png') });
  await page.click('#xDlg .x');

  // reports: replacement plan and cost per unit
  await page.click('nav.tabs button[data-v="reports"]');
  ok(/Replace now/.test(await page.textContent('#rpView')), 'replacement plan summary');
  await page.click('#rpPrint');
  ok(/REPLACEMENT PLAN/.test(await page.innerHTML('#printArea')), 'replacement plan prints');
  ok(/ICT-0001/.test(await page.textContent('#cuView')), 'cost per unit lists the unit with parts');

  // dashboard
  await page.click('nav.tabs button[data-v="dash"]');
  ok(await page.locator('#v-dash .chart svg').count() === 6, 'six charts drawn');
  await page.hover('#cJo g.bh >> nth=11');
  ok(await page.isVisible('.tip') && /job order/.test(await page.textContent('.tip')), 'chart hover shows the number');
  await page.screenshot({ path: path.join(shots, '23-dashboard.png'), fullPage: true });

  // accounts: the Head adds a technician
  await page.click('nav.tabs button[data-v="acc"]');
  await page.waitForFunction(() => document.querySelectorAll('#uTable tbody tr').length === 1);
  await page.click('#addUser'); await page.waitForSelector('#uDlg[open]');
  await page.fill('#uName', 'Argie R. Lopez'); await page.press('#uName', 'Escape'); await page.press('#uName', 'Tab');
  ok(await page.inputValue('#uUser') === 'alopez', 'username suggested from the name');
  await page.click('#uSave');
  await page.waitForSelector('#uTemp:not(.hidden)');
  const temp = (await page.textContent('#uTemp .temp')).trim();
  ok(/^[a-z]{5}\d{4}$/.test(temp), 'temporary password shown once');
  await page.screenshot({ path: path.join(shots, '24-accounts.png') });
  await page.click('#uDlg .df [data-close]');
  await page.click('#bkNow');
  await page.waitForFunction(() => /Done/.test(document.getElementById('bkMsg').textContent));
  ok(/Last backup/.test(await page.textContent('#bkInfo')), 'backup now');

  // the Head imports equipment and PM records from an Excel file
  await page.click('nav.tabs button[data-v="inv"]');
  const before = await page.evaluate(() => D.inventory.length);
  const msgs = []; const onDlg = d => msgs.push(d.message()); page.on('dialog', onDlg);
  await page.setInputFiles('#iImpFile', path.join(__dirname, 'fixtures', 'import-sample.xlsx'));
  await page.waitForFunction(n => D.inventory.length === n + 2, before);
  page.off('dialog', onDlg);
  const imp = await page.evaluate(() => ({ a: D.inventory.find(i => i.id === 'ICT-0101'), b: D.inventory.find(i => i.serial === 'FIX-SN-102'), p: D.pms.find(p => p.ref === 'PM-2026-090') }));
  ok(imp.a && imp.a.acquired === '2023-06-01' && +imp.a.cost === 45000 && imp.b && imp.b.lastPm === '2026-09-10' && imp.b.nextDue && imp.p, 'Excel import: ' + JSON.stringify(imp));
  ok(/2 units for the masterlist and 1 PM record/.test(msgs[0] || ''), 'import asks first: ' + msgs[0]);

  // public pages: a phone scans the QR label (no passcode)
  const pub = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  pub.on('pageerror', e => errors.push(e.message));
  pub.on('dialog', d => d.accept());
  await pub.addInitScript(() => { localStorage.setItem('pms.gsUrl', 'http://localhost:8799/api'); window.print = () => { window.__printed = 1; }; });
  await pub.goto('http://localhost:8799/#eq=ICT-0001');
  await pub.waitForFunction(() => /Open job orders/.test(document.getElementById('pubEq').textContent));
  const pubText = await pub.textContent('#pubEq');
  ok(/ICT-0001/.test(pubText) && !/Santos/i.test(pubText), 'QR page shows status, no names');
  ok(await pub.isHidden('#app') && await pub.isHidden('#lock'), 'no sign-in needed for the QR page');
  await pub.screenshot({ path: path.join(shots, '15-qr-status-phone.png'), fullPage: true });
  await pub.click('text=Report a problem with this unit');
  await pub.waitForSelector('#reqForm:not(.hidden)');
  await pub.waitForFunction(() => document.getElementById('rEquip').value === 'Desktop Computer');
  await pub.click('#reqSend');
  ok(/Please fill in: last name, first name/.test(await pub.textContent('#reqMsg')), 'request form checks the required fields');
  await pub.fill('#rLn', 'Cruz'); await pub.fill('#rFn', 'Ana'); await pub.check('#rt2_0'); await pub.fill('#rDesc', 'No internet since 8 AM.'); await pub.check('#rConsent');
  await pub.screenshot({ path: path.join(shots, '16-request-phone.png'), fullPage: true });
  await pub.click('#reqSend');
  await pub.waitForSelector('#reqDone:not(.hidden)');
  ok(/Your JO No. is ICTU-\d{4}-0002/.test(await pub.textContent('#reqDone')), 'staff request gets a JO number');
  await pub.click('#reqPrint');
  ok(/No internet since 8 AM/.test(await pub.innerHTML('#printArea')), 'requestor can print the filled form');
  ok(!(await pub.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'no sideways scroll on the request page');
  await pub.click('#reqAgain'); await pub.waitForSelector('#reqForm:not(.hidden)');
  await pub.check('#rt3_0');
  ok(await pub.isHidden('#rEqPanel') && await pub.isHidden('#rLoc') && await pub.isVisible('#rHead') && await pub.isHidden('#rConsent') && /when you need it/.test(await pub.getAttribute('#rDesc', 'placeholder')), 'a data request asks no equipment questions, only the Section / Unit Head');
  await pub.uncheck('#rt3_0'); await pub.check('#rt3_3');
  ok(await pub.isHidden('#rEqPanel') && await pub.textContent('#rLocL') === 'Venue' && await pub.isHidden('#rHead'), 'event support asks for the venue only');
  await pub.screenshot({ path: path.join(shots, '16b-request-service.png'), fullPage: true });
  await pub.check('#rt1_0');
  ok(await pub.isVisible('#rEqPanel') && await pub.textContent('#rLocL') === 'Location' && await pub.isVisible('#rConsent'), 'a software concern shows the equipment fields');
  await pub.close();

  // phone
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  phone.on('pageerror', e => errors.push(e.message));
  await phone.goto('http://localhost:8799/');
  await phone.fill('#urlIn', 'http://localhost:8799/api'); await phone.fill('#uIn', 'alopez'); await phone.fill('#pwIn', temp);
  await phone.screenshot({ path: path.join(shots, '00c-lock-phone.png'), fullPage: true });
  await phone.click('#lockBtn');
  await phone.waitForSelector('#chgForm:not(.hidden)');
  ok(true, 'temporary password asks for a new one');
  await phone.fill('#chgPw', 'lopez2026x'); await phone.fill('#chgPw2', 'lopez2026x'); await phone.click('#chgBtn');
  await phone.waitForSelector('#app:not(.hidden)');
  ok(await phone.isVisible('#pbar [data-p="pm"]') && await phone.isHidden('nav.tabs'), 'phone: bottom bar with Do PM, no sideways tab strip');
  await phone.click('#pbar [data-p="more"]');
  ok(await phone.isHidden('nav.tabs button[data-v="acc"]') && await phone.isVisible('nav.tabs button[data-v="stock"]'), 'phone: More lists the other screens, technician sees no Accounts');
  await phone.screenshot({ path: path.join(shots, '07b-phone-more.png') });
  await phone.click('nav.tabs button[data-v="inv"]');
  ok(await phone.isHidden('nav.tabs') && await phone.getAttribute('#pbar [data-p="inv"]', 'aria-current') === 'page', 'phone: picking a screen closes the list and marks Inventory');
  const card = await phone.evaluate(() => { const tr = document.querySelector('#iTable tbody tr[data-id]'); return getComputedStyle(tr).display + ' ' + Math.round(document.querySelector('#iTable th .sortb').getBoundingClientRect().height); });
  ok(/^grid (4[4-9]|[5-9]\d)$/.test(card), 'phone: masterlist units are cards and sort buttons are at least 44 px tall: ' + card);
  await phone.screenshot({ path: path.join(shots, '07c-phone-inventory.png') });
  await phone.click('#pbar [data-p="home"]');
  await phone.screenshot({ path: path.join(shots, '07-phone-home.png'), fullPage: true });
  await phone.click('#homeDue [data-pm]');
  await phone.waitForSelector('#pmBody:not(.hidden)');
  await phone.screenshot({ path: path.join(shots, '08-phone-pm.png'), fullPage: true });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  ok(!overflow, 'no sideways scroll on phone');

  // new job order alerts, on the Head's laptop
  await page.bringToFront();
  await page.click('nav.tabs button[data-v="home"]');
  const filed = await page.evaluate(async () => (await (await fetch('http://localhost:8799/api', { method: 'POST', body: JSON.stringify({ action: 'submitJO',
    jo: { lastName: 'Dela Cruz', firstName: 'Maria', unit: 'Billing Section', description: 'Printer shows paper jam but there is no paper stuck inside.', types: ['Printer / scanner problem'], urgent: 'Yes', urgentReason: 'Billing statements are due today' } }) })).json()));
  ok(filed.ok, 'a request filed on the request page');
  await page.evaluate(() => peekJo());
  await page.waitForSelector('#joToast:not(.hidden)');
  ok(/Dela Cruz/i.test(await page.textContent('#jtBody')) && /urgent/.test(await page.textContent('#jtTitle')) && /^\d+ new$/.test(await page.textContent('#navJo')), 'the 2-minute check shows the pop-up and "N new": ' + await page.textContent('#navJo'));
  const newCount = await page.textContent('#navJo');
  await page.screenshot({ path: path.join(shots, '20-new-jo-alert.png') });
  await page.evaluate(() => peekJo());
  ok(await page.textContent('#navJo') === newCount, 'the same request is not counted twice');
  await page.evaluate(no => { $('jtOpen').dataset.jo = no; }, filed.jo);   // with more than one, the button opens the list; here, the newest
  await page.click('#jtOpen');
  ok(await page.evaluate(() => $('joDlg').open) && await page.inputValue('#jDesc') === 'Printer shows paper jam but there is no paper stuck inside.' && await page.isHidden('#joToast') && !/new/.test(await page.textContent('#navJo')), 'Open job order opens it and clears the count');
  await page.evaluate(() => $('joDlg').close());
  await page.click('nav.tabs button[data-v="acc"]');
  await page.waitForFunction(() => /Emails are off/.test($('alInfo').textContent));
  await page.fill('#alEmails', 'not an email'); await page.click('#alSave');
  await page.waitForFunction(() => $('alMsg').classList.contains('err'));
  await page.fill('#alEmails', 'ictu.head@example.com, argie@example.com'); await page.click('#alSave');
  await page.waitForFunction(() => $('alMsg').classList.contains('ok'));
  await page.click('#alTest');
  await page.waitForFunction(() => /Test email sent/.test($('alMsg').textContent));
  ok(be.gas._mails.length === 1 && /^\[TEST\]/.test(be.gas._mails[0].subject) && /Emails are on/.test(await page.textContent('#alInfo')), 'the Head sets the emails and sends a test');
  await page.screenshot({ path: path.join(shots, '21-alert-emails.png'), fullPage: true });
  await page.click('nav.tabs button[data-v="dash"]');
  ok(/never had a PM yet/.test(await page.textContent('#dTiles')), 'Dashboard says how many units never had a PM');

  // one window at a time: the email link in a new tab hands the job order to the window that is already open
  await page.context().addInitScript(() => { new MutationObserver(() => { const f = document.getElementById('lockForm'); if (f && !f.classList.contains('hidden') && f.offsetParent) window.__sawSignIn = true; }).observe(document, { subtree: true, childList: true, attributes: true }); });
  await page.click('nav.tabs button[data-v="home"]');
  const [tab2] = await Promise.all([page.waitForEvent('popup'), page.evaluate(no => window.open('/#jo=' + no, '_blank'), filed.jo)]);
  await Promise.race([tab2.waitForEvent('close'), tab2.waitForSelector('#movedPane:not(.hidden)')]).catch(() => {});
  await page.waitForFunction(() => $('joDlg').open);
  ok(await page.inputValue('#jDesc') === 'Printer shows paper jam but there is no paper stuck inside.' && await page.isVisible('#v-jo'), 'the open window goes to Job Orders and opens the job order from the link');
  ok(tab2.isClosed() || (await tab2.isHidden('#app') && /Job order .* is open in your app window/.test(await tab2.textContent('#movedT'))), 'the new tab does not open a second app: it closes, or only says the app is open in the other window');
  if (!tab2.isClosed()) { ok(await tab2.evaluate(() => !!window.__sawSignIn) === false, 'the new tab never shows the sign-in form'); await page.screenshot({ path: path.join(shots, '22-handed-over.png') }); await tab2.close(); }
  ok(await page.evaluate(() => peekTimer !== null), 'the open window keeps checking for new job orders');
  await page.evaluate(() => $('joDlg').close());

  // in the middle of a form: the link waits in a note instead of covering it
  await page.evaluate(() => $('joDlg').showModal());
  const [tab3] = await Promise.all([page.waitForEvent('popup'), page.evaluate(no => window.open('/#jo=' + no, '_blank'), filed.jo)]);
  await page.waitForSelector('#joToast:not(.hidden)');
  ok(/Job order/.test(await page.textContent('#jtTitle')) && await page.getAttribute('#jtOpen', 'data-jo') === filed.jo, 'with a form open, the job order waits in a note');
  if (!tab3.isClosed()) await tab3.close();
  await page.evaluate(() => $('joDlg').close()); await page.click('#jtX');

  // no app running: the link opens the app in that tab as usual
  await page.evaluate(() => { tabChan.onmessage = null; });
  const [p2] = await Promise.all([page.waitForEvent('popup'), page.evaluate(no => window.open('/#jo=' + no, '_blank'), filed.jo)]);
  await p2.waitForSelector('#app:not(.hidden)');
  ok(await p2.evaluate(() => $('joDlg').open) && await p2.evaluate(() => !!window.__sawSignIn) === false, 'with no app window running, the link opens the app and the job order without the sign-in form');
  await p2.close();
  await page.evaluate(() => { location.reload(); });
  await page.waitForSelector('#app:not(.hidden)');

  await page.evaluate(() => { location.hash = 'jo=ICTU-0000-TEST'; });
  await page.waitForSelector('#joToast:not(.hidden)');
  ok(/test email/.test(await page.textContent('#jtBody')) && await page.isHidden('#jtOpen'), 'the test email link says it is a test');
  await page.click('#jtX');

  // PM round and catch-up schedule on the PMS schedule page
  await page.click('nav.tabs button[data-v="sched"]');
  await page.click('#sRound');
  await page.waitForSelector('#roundDlg[open]');
  await page.click('#rdLate');
  const ticked = await page.evaluate(() => roundTicked.size);
  await page.screenshot({ path: path.join(shots, '23-pm-round.png') });
  await page.evaluate(() => { roundTicked.clear(); renderRound(); });
  await page.locator('#rdList input').first().check(); await page.selectOption('#rdBy', { index: 1 });
  await page.click('#rdSave');
  await page.waitForFunction(() => /Saved 1 PM record/.test($('rdMsg').textContent));
  ok(ticked > 0, 'Record a PM round ticks all overdue units at once, and saves a record for each ticked unit');
  await page.evaluate(() => $('roundDlg').close());
  const lateBefore = await page.evaluate(() => D.inventory.filter(it => pmState(it) === 'late').length);
  const seen = []; const onSeen = d => seen.push(d.message()); page.on('dialog', onSeen);
  await page.click('#sCatch');
  await page.waitForFunction(() => !D.inventory.some(it => pmState(it) === 'late'));
  await page.waitForTimeout(300); page.off('dialog', onSeen);
  const said = seen.join(' | ');
  ok(lateBefore > 0 && /planned from/.test(said) && await page.evaluate(() => D.inventory.filter(it => pmState(it) === 'late').length) === 0, 'Catch-up schedule leaves no unit overdue: ' + said);
  await page.screenshot({ path: path.join(shots, '24-after-catch-up.png'), fullPage: true });

  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  console.log('e2e: ' + n + ' checks passed');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
