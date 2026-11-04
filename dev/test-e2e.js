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
  ok(late === 0 && +await page.textContent('#tDue') === 7, 'never serviced units with no date bought are due this quarter, not overdue: late ' + late + ', due ' + await page.textContent('#tDue'));
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
  { const letter = await page.pdf({ format: 'Letter', margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }, printBackground: true });
    const n = (letter.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(n === 1, 'PM checklist prints on one page at 100%, even on short bond (Letter): ' + n + ' page(s)'); }
  const pages = await page.evaluate(() => { const el = document.querySelector('#printArea .sheet'); return el.getBoundingClientRect().height; });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => document.body.classList.remove('printing'));
  console.log('form height mm', Math.round(pages * 25.4 / 96));

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
  ok(rows === 9, 'only PM units (desktops, laptops, printers) in the schedule: ' + rows);
  ok(await page.locator('#sTable thead th').filter({ hasText: 'Jan-Mar' }).count() === 1, 'schedule columns are the quarters');
  ok(await page.locator('#sTable .mk.done').count() >= 1, 'done mark shown');
  await page.screenshot({ path: path.join(shots, '06-schedule.png') });
  await page.click('#sPrint');
  ok(/PREVENTIVE MAINTENANCE SCHEDULE, CY 2026/.test(await page.innerHTML('#printArea')) && /Oct-Dec/.test(await page.innerHTML('#printArea')), 'schedule print by quarter');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-schedule.pdf'), format: 'A4', landscape: true, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  // sort, then a calendar page for each section
  await page.selectOption('#sSort', 'next');
  ok(await page.$eval('#sTable tbody tr td b', b => b.textContent) !== 'ICT-0029', 'sort by next PM puts the done unit last');
  await page.selectOption('#sSort', 'office');
  ok(await page.evaluate(() => [...$('spQ').options].some(o => /^Jan-Mar 2026/.test(o.textContent))), 'the quarter list starts at Jan-Mar of this year');
  // PM by section: plan the quarter, print the schedule, a notice and the PMS result form
  await page.click('#spMake');
  await page.waitForFunction(() => /section\(s\) planned/.test($('spMsg').textContent));
  const nSec = await page.evaluate(() => planSecs().filter(s => secUnits(s, $('spQ').value).some(x => !x.sv.length)).length);
  ok(nSec > 0 && await page.locator('#spTable tbody tr[data-plan]').count() === nSec, 'one plan per section with units due: ' + nSec);
  ok(await page.evaluate(() => plansOf($('spQ').value).every(p => ![0, 5, 6].includes(new Date(p.start + 'T12:00:00').getDay()))), 'PM days are Monday to Thursday');
  await page.screenshot({ path: path.join(shots, '06b-section-plan.png'), fullPage: true });
  await page.click('#spPrint');
  ok(/PREVENTIVE MAINTENANCE SCHEDULE OF ICT EQUIPMENT/.test(await page.innerHTML('#printArea')), 'quarter schedule by section printed');
  await page.click('#spTable tbody tr[data-plan] [data-notice]');
  ok(/NOTICE OF PREVENTIVE MAINTENANCE/.test(await page.innerHTML('#printArea')) && /RECEIVED BY/.test(await page.innerHTML('#printArea')), 'notice to the section printed');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-section-notice.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  await page.click('#spTable tbody tr[data-plan] td b');
  await page.waitForSelector('#ppDlg[open]');
  await page.fill('#ppAStart', await page.evaluate(() => todayStr())); await page.fill('#ppAEnd', await page.evaluate(() => todayStr()));
  await page.fill('#ppRecv', 'Ana Liza M. Garcia'); await page.fill('#ppPos', 'Section Head');
  await page.screenshot({ path: path.join(shots, '06c-plan-edit.png') });
  await page.click('#ppSave');
  await page.waitForFunction(() => !$('ppDlg').open);
  ok(await page.evaluate(() => plansOf($('spQ').value)[0].status === 'Done'), 'actual finish marks the section Done');
  await page.click('#spClear');
  await page.waitForFunction(() => /cleared for/.test($('spMsg').textContent));
  ok(await page.locator('#spTable tbody tr[data-plan]').count() === 1, 'Clear this quarter keeps only the section already done');
  await page.click('#spMake');
  await page.waitForFunction(() => /section\(s\) planned/.test($('spMsg').textContent));
  ok(await page.locator('#spTable tbody tr[data-plan]').count() === nSec, 'the sections can be planned again after clearing');
  await page.click('#spTable tbody tr[data-plan] [data-result]');
  const res = await page.innerHTML('#printArea');
  ok(/PREVENTIVE MAINTENANCE RESULT/.test(res) && /CONFORME/.test(res) && /SUMMARY/.test(res), 'PMS result form printed with the summary and the sign-off');
  await page.evaluate(() => document.body.classList.add('printing'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(shots, 'sample-pms-result.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true });
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
  ok(await page.locator('#blankIso option').count() >= 11 && await page.locator('#rPrintInv').isHidden(), 'blank forms are one dropdown that follows the ISO documents, without the doubles');
  await page.selectOption('#blankIso', 'COH-IDN-F-02'); await page.click('#blankPrint');
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
  { const letter = await page.pdf({ format: 'Letter', margin: { top: '8mm', bottom: '8mm', left: '10mm', right: '10mm' }, printBackground: true });
    const n = (letter.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(n === 1, 'job order form prints on one page at 100%, even on short bond (Letter): ' + n + ' page(s), zoom ' + await page.evaluate(() => document.querySelector('#printArea .sheet').style.zoom)); }
  const joH = await page.evaluate(() => document.querySelector('#printArea .sheet').getBoundingClientRect().height);
  await page.emulateMedia({ media: 'screen' }); await page.evaluate(() => document.body.classList.remove('printing'));
  console.log('JO form height px', Math.round(joH), 'mm', Math.round(joH * 25.4 / 96), 'zoom', await page.evaluate(() => document.querySelector('#printArea .sheet').style.zoom));
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
  ok(/No PM yet|Overdue|Due /.test(await page.textContent('#iTable tbody tr td:last-child')), 'next PM puts the overdue and due first');
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
  await page.waitForFunction(() => /Added as NET-003/.test(document.getElementById('nMsg').textContent));
  await page.click('#nDlg .x');
  await page.click('#addNet'); await page.selectOption('#nKindIn', 'Switch'); await page.fill('#nName', 'Second switch'); await page.fill('#nIp', '192.168.1.1');
  await page.click('#nSave');
  await page.waitForFunction(() => /already used by NET-003/.test(document.getElementById('nMsg').textContent));
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
  await page.evaluate(() => { D.inventory.filter(it => freqM(it)).slice(0, 3).forEach(it => it.nextDue = '2025-01-01'); renderRound(); });
  await page.click('#rdLate');
  const ticked = await page.evaluate(() => roundTicked.size);
  await page.screenshot({ path: path.join(shots, '23-pm-round.png') });
  await page.evaluate(() => { roundTicked.clear(); renderRound(); });
  await page.locator('#rdList input').first().check(); await page.selectOption('#rdBy', { index: 1 });
  await page.click('#rdSave');
  await page.waitForFunction(() => /Saved 1 PM record/.test($('rdMsg').textContent));
  ok(ticked > 0, 'Record a PM round ticks all overdue units at once, and saves a record for each ticked unit');
  await page.evaluate(() => $('roundDlg').close());
  await page.evaluate(() => reload());
  ok(await page.locator('#sCatch').count() === 0, 'the catch-up schedule is gone (the section plan replaces it)');

  // employee masterlist under Accounts: change the section and add a designation
  await page.click('nav.tabs button[data-v="acc"]');
  await page.waitForFunction(() => $('emTable').tBodies[0].rows.length > 1);
  await page.fill('#emQ', 'garcia');
  await page.click('#emTable tbody tr[data-em]');
  await page.waitForSelector('#emDlg[open]');
  await page.selectOption('#edOffice', 'Budget Section');
  await page.locator('#emAlso input[value="Cash Unit"]').check();
  await page.selectOption('#edEmp', 'Job Order Employee');
  await page.screenshot({ path: path.join(shots, '27-employee-edit.png') });
  await page.click('#emSave');
  await page.waitForFunction(() => !$('emDlg').open);
  ok(await page.evaluate(() => { const e = D.employees.find(x => x.name === 'Ana Liza M. Garcia'); return e.office === 'Budget Section' && e.also.includes('Cash Unit'); }), 'employee section and designation saved');
  await page.fill('#emQ', '');
  ok(await page.evaluate(() => D.employees.find(x => x.name === 'Ana Liza M. Garcia').employment === 'Job Order Employee'), 'employment (Job Order) saved');
  await page.click('#emAddSec'); await page.waitForSelector('#offDlg[open]');
  await page.fill('#oName', 'Records Section'); await page.click('#offSave');
  await page.waitForFunction(() => !$('offDlg').open);
  ok(await page.evaluate(() => D.lists.offices.includes('Records Section')), 'a section / unit can be added from the employee masterlist');
  // backup email
  await page.fill('#bkEmail', 'argie@example.com'); await page.click('#bkSaveEmail');
  await page.waitForFunction(() => /Saved/.test($('bkMsg').textContent));
  await page.click('#bkNow');
  await page.waitForFunction(() => /emailed to argie@example.com/.test($('bkMsg').textContent));
  ok(true, 'backup emailed to the ICTU staff');
  await page.screenshot({ path: path.join(shots, '28-accounts-employees.png'), fullPage: true });

  // rename a section (Head)
  await page.click('nav.tabs button[data-v="acc"]');
  await page.click('#iRen'); await page.waitForSelector('#renDlg[open]');
  await page.selectOption('#renFrom', 'ICTU'); await page.fill('#renTo', 'IDADIN/ICTU'); await page.click('#renSave');
  await page.waitForFunction(() => /is now "IDADIN\/ICTU"/.test($('renMsg').textContent));
  ok(await page.evaluate(() => D.inventory.some(i => i.office === 'IDADIN/ICTU') && !D.inventory.some(i => i.office === 'ICTU')), 'Rename a section renames every unit under it');
  await page.evaluate(() => $('renDlg').close());

  // dashboard: a section bar opens the inventory list for that section
  await page.click('nav.tabs button[data-v="dash"]');
  const firstSec = await page.getAttribute('#cOff g.go', 'data-label');
  await page.click('#cOff g.go');
  await page.waitForSelector('#v-inv:not(.hidden)');
  ok(await page.inputValue('#iOffice') === firstSec && await page.evaluate(s => [...document.querySelectorAll('#iTable tbody tr[data-id]')].every(tr => byId(tr.dataset.id).office === s), firstSec), 'clicking a section on the dashboard lists only its equipment: ' + firstSec);

  // due for replacement tile opens the list with specs
  await page.click('nav.tabs button[data-v="dash"]');
  await page.click('#dTiles [data-go="due"]');
  await page.waitForSelector('#dueDlg[open]');
  ok(/Due for replacement/.test(await page.textContent('#dueT')) && await page.evaluate(() => $('dueTable').tBodies[0].rows.length === Math.max(1, dueRows().length)), 'Due for replacement opens the list of those units');
  await page.screenshot({ path: path.join(shots, '25-due-replacement.png') });
  await page.evaluate(() => $('dueDlg').close());
  // Do PM marks
  await page.click('nav.tabs button[data-v="pm"]');
  ok(await page.evaluate(() => [...document.querySelectorAll('#pmList button')].length > 0 && [...document.querySelectorAll('#pmList button')].every(b => b.querySelector('.pmk'))), 'Do PM shows an overdue, planned or done mark on each unit');
  ok(await page.locator('#pmList button[data-sec]').count() > 0 && await page.locator('#pmList button[data-id]').count() === 0, 'Do PM starts with the sections');
  await page.screenshot({ path: path.join(shots, '26-do-pm-sections.png') });
  await page.locator('#pmList button[data-sec]').first().click();
  ok(await page.locator('#pmList button[data-id]').count() > 0, 'picking a section lists its units');
  await page.locator('#pmList button[data-id]').first().click();
  ok(/Next PM:/.test(await page.textContent('#pmSelN')) && /Last PM:/.test(await page.textContent('#pmSelN')), 'Do PM shows the next PM of the picked unit');
  await page.screenshot({ path: path.join(shots, '26c-do-pm-next.png') });
  await page.click('#pmChange');
  await page.screenshot({ path: path.join(shots, '26b-do-pm-section-units.png') });
  // Tick all overdue follows the search
  await page.click('nav.tabs button[data-v="sched"]');
  await page.click('#sRound'); await page.waitForSelector('#roundDlg[open]');
  await page.evaluate(() => D.inventory.forEach(it => { if (freqM(it)) it.nextDue = '2025-01-01'; }));
  await page.fill('#rdQ', 'printer'); await page.click('#rdLate');
  ok(await page.evaluate(() => roundTicked.size > 0 && [...roundTicked].every(id => /printer/i.test(byId(id).type + byId(id).brand))), 'Tick all overdue with a search ticks only the matching units');
  await page.evaluate(() => roundTicked.clear()); await page.fill('#rdQ', 'zzzz-nothing'); await page.click('#rdLate');
  ok(await page.evaluate(() => roundTicked.size === D.inventory.filter(it => pmState(it) === 'late' && freqM(it) && active(it) && it.condition !== 'Unserviceable').length), 'with no match it ticks all overdue units');
  await page.evaluate(() => { $('roundDlg').close(); }); await page.evaluate(() => reload());

  // for disposal: tick, print the IIRUP list, mark Disposed
  const dispId = await page.evaluate(async () => (await api({ action: 'saveEquipment', item: { type: 'Laptop', brand: 'E2E Old Laptop', serial: 'E2E-DISP-1', office: 'IDADIN/ICTU', condition: 'Unserviceable', acquired: '2014-05-01' } })).id);
  await page.evaluate(() => reload());
  await page.click('nav.tabs button[data-v="inv"]');
  await page.click('#iDisp'); await page.waitForSelector('#dispDlg[open]');
  ok(await page.evaluate(id => dispUnits().some(it => it.id === id) && dispUnits().every(it => it.condition === 'Unserviceable'), dispId), 'For disposal lists only Unserviceable units');
  await page.check('#dispList input[value="' + dispId + '"]');
  const pr0 = await page.evaluate(() => window.__printed || 0);
  await page.click('#dispPrint');
  await page.waitForFunction(n => (window.__printed || 0) > n, pr0);
  ok(await page.evaluate(id => /FOR DISPOSAL/.test($('printArea').innerHTML) && $('printArea').innerHTML.includes(id) && /IIRUP/.test($('printArea').innerHTML), dispId), 'the list for the IIRUP prints with the ticked unit');
  await page.screenshot({ path: path.join(shots, '26-for-disposal.png') });
  await page.fill('#dispDoc', 'IIRUP-2026-001');
  await page.click('#dispSave');
  await page.waitForFunction(() => /Disposed/.test($('dispMsg').textContent) && !$('dispSave').disabled);
  ok(await page.evaluate(id => D.inventory.find(i => i.id === id).condition === 'Disposed' && !dispUnits().some(i => i.id === id), dispId), 'the ticked unit is marked Disposed and leaves the list: ' + await page.textContent('#dispMsg'));
  await page.evaluate(() => $('dispDlg').close());

  // internet downtime log
  await page.evaluate(async () => { await api({ action: 'saveNetwork', item: { kind: 'Internet Line', name: 'E2E Fiber', provider: 'E2E ISP' } }); await reload(); });
  await page.click('nav.tabs button[data-v="down"]');
  await page.click('#newDown'); await page.waitForSelector('#wDlg[open]');
  ok(await page.evaluate(() => [...$('wFLine').options].some(o => /E2E Fiber/.test(o.text))), 'the downtime form lists the internet lines from Network and IP');
  await page.evaluate(() => { const d = new Date(Date.now() - 90 * 60e3); $('wDown').value = isoDate(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); $('wDown').dispatchEvent(new Event('input')); });
  await page.selectOption('#wFLine', { label: 'E2E Fiber (E2E ISP)' }); await page.selectOption('#wCause', 'ISP outage');
  await page.click('#wSave');
  await page.waitForFunction(() => /Recorded as DT-/.test($('wMsg').textContent));
  await page.evaluate(() => $('wDlg').close());
  ok(await page.evaluate(() => /E2E Fiber .*is down/.test($('wOngoing').textContent) && $('navDown').textContent === '1'), 'a line that is still down shows a red note and a count on the menu');
  await page.screenshot({ path: path.join(shots, '27-internet-down.png'), fullPage: true });
  await page.click('#wOngoing [data-wback]'); await page.waitForSelector('#wDlg[open]');
  await page.click('#wSave');
  await page.waitForFunction(() => /Down for/.test($('wMsg').textContent));
  await page.evaluate(() => $('wDlg').close());
  ok(await page.evaluate(() => !$('wOngoing').textContent && D.downtime.some(w => w.status === 'Restored' && w.hours >= 1.4) && /uptime/.test($('wTiles').textContent)), 'It is back now closes the outage and the month shows the uptime');
  // router setup (Head): the commands and the script with the link and key filled in
  await page.click('#wRouter'); await page.waitForSelector('#rtDlg[open]');
  await page.waitForFunction(() => /trcdQueue/.test($('rtScript').value));
  ok(await page.evaluate(() => /:local key "[a-f0-9]{40}"/.test($('rtScript').value) && /"ether6 - ISP IN"/.test($('rtScript').value) && !/max-redirect/.test($('rtScript').value) && /gateway="ISP IN"/.test($('rtSetup').value) && /8\.8\.4\.4\/32 gateway=192\.168\.1\.1/.test($('rtSetup').value) && /netwatch add host=1\.0\.0\.1/.test($('rtSetup').value)), 'Router setup gives the router script with the key and the PLDT and Starlink checks');
  await page.screenshot({ path: path.join(shots, '29-router-setup.png') });
  await page.evaluate(() => $('rtDlg').close());
  // picture for the guide: how entries logged by the router look (shown only, not saved)
  await page.evaluate(() => { window.__keepDown = D.downtime; window.__keepNet = D.network;
    D.network = D.network.filter(n => n.name === 'PLDT' || n.name === 'Starlink');
    const pl = D.network.find(n => n.name === 'PLDT').id, st = D.network.find(n => n.name === 'Starlink').id, R = 'Router (automatic)', t = todayStr();
    D.downtime = [
      { no: 'DT-2026-004', line: pl, lineName: 'PLDT', down: t + ' 06:12', up: '', hours: '', scope: 'Backup line took over', cause: 'Unknown', status: 'Ongoing', reportedBy: R },
      { no: 'DT-2026-003', line: st, lineName: 'Starlink', down: t.slice(0, 8) + '02 14:03', up: t.slice(0, 8) + '02 14:21', hours: 0.3, scope: 'Backup line took over', cause: 'Unknown', status: 'Restored', reportedBy: R },
      { no: 'DT-2026-002', line: pl, lineName: 'PLDT', down: t.slice(0, 8) + '02 13:55', up: t.slice(0, 8) + '02 14:40', hours: 0.75, scope: 'Backup line took over', cause: 'ISP outage', ticket: 'PLDT-118842', status: 'Restored', reportedBy: R },
      { no: 'DT-2026-001', line: pl, lineName: 'PLDT', down: t.slice(0, 8) + '01 22:10', up: t.slice(0, 8) + '02 01:40', hours: 3.5, scope: 'Backup line took over', cause: 'Power interruption', status: 'Restored', reportedBy: R }];
    renderDown(); });
  await page.screenshot({ path: path.join(shots, '30-router-log.png'), fullPage: true });
  await page.evaluate(() => { D.downtime = window.__keepDown; D.network = window.__keepNet; renderDown(); });
  const pr1 = await page.evaluate(() => window.__printed || 0);
  await page.click('#wPrint'); await page.waitForFunction(n => (window.__printed || 0) > n, pr1);
  ok(await page.evaluate(() => /INTERNET DOWNTIME REPORT/.test($('printArea').innerHTML) && /E2E Fiber/.test($('printArea').innerHTML) && /both lines down/.test($('printArea').innerHTML)), 'the monthly downtime report prints');
  await page.screenshot({ path: path.join(shots, '28-internet-downtime.png'), fullPage: true });
  ok(await page.evaluate(() => { const keep = [D.network, D.downtime];
    D.network = [{ id: 'N1', kind: 'Internet Line', name: 'Main', status: 'Active' }, { id: 'N2', kind: 'Internet Line', name: 'Backup', status: 'Active' }];
    D.downtime = [{ no: 'A', line: 'N1', down: '2026-10-02 08:00', up: '2026-10-02 12:00' }, { no: 'B', line: 'N2', down: '2026-10-02 11:00', up: '2026-10-02 13:00' }, { no: 'C', line: 'N1', down: '2026-10-09 08:00', up: '2026-10-09 09:00' }];
    const S = downMonth('2026-10'); [D.network, D.downtime] = keep;
    return Math.abs(S.whole.down - 1) < 1e-9 && S.whole.events === 1 && Math.abs(S.lines.find(l => l.id === 'N1').down - 5) < 1e-9 && Math.abs(S.lines.find(l => l.id === 'N2').down - 2) < 1e-9; }),
    'the office counts as without internet only while both lines are down');

  ok(!errors.length, 'no page errors: ' + errors.join(' | '));
  console.log('e2e: ' + n + ' checks passed');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
