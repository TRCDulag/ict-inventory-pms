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
  ok(await page.isVisible('#lockReq') && await page.isVisible('.privacy'), 'lock screen offers the request page and shows the privacy notice');
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
  // picking an employee sets the section; changing the employee changes it again; the last line of a list adds a new one
  await page.fill('#eOffice', '');
  await page.fill('#eEndUser', 'ana liza m garcia'); await page.press('#eEndUser', 'Tab');
  ok(await page.inputValue('#eEndUser') === 'Ana Liza M. Garcia' && await page.inputValue('#eOffice') === 'Accounting Section', 'typed masterlist name sets the section');
  await page.fill('#eEndUser', 'santos');
  ok(await page.isVisible('#eEndUserList'), 'employee list opens while typing');
  await page.screenshot({ path: path.join(shots, '10-employee-list.png') });
  await page.press('#eEndUser', 'Enter');
  ok(await page.inputValue('#eEndUser') === 'Maria Clara R. Santos' && await page.inputValue('#eOffice') === 'Budget Section', 'changing the employee changes the section');
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
  ok(await page.isVisible('#menuPanel') && await page.isVisible('#lockOut'), 'menu shows Refresh and Lock');
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
  await page.fill('#jEq', 'ICT-0001'); await page.press('#jEq', 'Escape'); await page.press('#jEq', 'Tab');
  ok(await page.inputValue('#jEquip') === 'Desktop Computer' && /MSI/.test(await page.inputValue('#jModel')), 'equipment code fills the equipment');
  await page.check('#jt0_0'); await page.fill('#jDesc', 'Computer restarts by itself.');
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
  ok(await page.isVisible('#iTable tfoot #addEq'), 'add equipment sits at the bottom of the list');

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

  // public pages: a phone scans the QR label (no passcode)
  const pub = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  pub.on('pageerror', e => errors.push(e.message));
  pub.on('dialog', d => d.accept());
  await pub.addInitScript(() => { localStorage.setItem('pms.gsUrl', 'http://localhost:8799/api'); window.print = () => { window.__printed = 1; }; });
  await pub.goto('http://localhost:8799/#eq=ICT-0001');
  await pub.waitForFunction(() => /Open job orders/.test(document.getElementById('pubEq').textContent));
  const pubText = await pub.textContent('#pubEq');
  ok(/ICT-0001/.test(pubText) && /ICTU-\d{4}-0001/.test(pubText) && !/Santos/i.test(pubText), 'QR page shows status and open JO, no names');
  ok(await pub.isHidden('#app') && await pub.isHidden('#lock'), 'no passcode needed for the QR page');
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
  await pub.close();

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
