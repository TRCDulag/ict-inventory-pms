// Backend rules test: runs apps-script/Code.gs against the in-memory mock. Run: node dev/test-backend.js
const assert = require('assert');
const { loadBackend, seed } = require('./mock-gas');

const be = loadBackend(); seed(be);
const call = req => JSON.parse(be.code.api(JSON.stringify(Object.assign({ pin: '1234', device: 'test' }, req))));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// passcode
ok(call({ action: 'load', pin: '9' }).error === 'Wrong ICTU passcode.', 'wrong pin refused');
ok(call({ action: 'ping', pin: '' }).ok, 'ping without pin');

// load and normalize
let L = call({ action: 'load' });
ok(L.ok, 'load ok ' + L.error);
ok(L.inventory.length === 29, 'seed has 29 units');
const epson = L.inventory.find(i => i.brand === 'Epson L3210');
ok(epson.lastRef === 'PM-2026-001' && epson.nextDue === '2027-01-05', 'next due filled from last PM: ' + epson.nextDue);
ok(L.pms.length === 1 && L.pms[0].quarter === 'Q4 2026', 'seed PM');
ok(L.lists.types.length === 11 && L.lists.staff.length === 2, 'lists tab read');

// add equipment
let r = call({ action: 'saveEquipment', item: { type: 'Desktop Computer', brand: 'Acer Veriton', serial: 'ABC123', tag: 'TRC-ICT-0099', office: 'ICTU', endUser: 'Argie R. Lopez', acquired: '2025-06-10', cost: '45,500.00', freq: '' }, by: 'tester' });
ok(r.ok && r.id === 'ICT-0030', 'new id ' + r.id + ' ' + r.error);
ok(r.item.freq === 'Quarterly' && r.item.cost === 45500 && r.item.acquired === '2025-06-10', 'defaults and parsing');
ok(r.item.nextDue === '', 'no PM yet means no next due');
ok(!call({ action: 'saveEquipment', item: { type: 'Monitor', brand: 'X', serial: 'abc123', office: 'ICTU' } }).ok, 'duplicate serial refused');
ok(!call({ action: 'saveEquipment', item: { type: 'Monitor', brand: '', office: 'ICTU' } }).ok, 'brand required');
// formula injection
r = call({ action: 'saveEquipment', item: { id: 'ICT-0030', type: 'Desktop Computer', brand: 'Acer Veriton', serial: 'ABC123', tag: 'TRC-ICT-0099', office: 'ICTU', endUser: '=HYPERLINK("x")', acquired: '2025-06-10', cost: '45500', freq: 'Quarterly' }, by: 'tester' });
ok(r.ok && r.item.endUser === 'HYPERLINK("x")', 'leading = stripped: ' + r.item.endUser);
ok(call({ action: 'saveEquipment', item: Object.assign({}, r.item, { id: 'ICT-0030', office: 'ICTU' }) }).unchanged, 'unchanged save detected');

// save a PM
const checks = [{ section: '1', item: 'Backup of the system created', result: 'Done' }, { section: '2', item: 'Fans check', result: 'Issue', note: 'noisy fan' }];
const sig = 'data:image/png;base64,' + Buffer.from('fakepng').toString('base64');
r = call({ action: 'savePM', pm: { equipmentId: 'ICT-0030', date: '2026-10-28', timeStart: '9:00 AM', timeEnd: '9:40 AM', personnel: 'Argie R. Lopez',
  overall: 'Functional, for monitoring', findings: 'Fans check: noisy fan', action: 'Cleaned fan', activity: 'Cleaning', os: 'Windows 11 Pro', ackBy: 'Argie R. Lopez', verifiedBy: 'James Adrian M. Elona' },
  checks, signature: sig });
ok(r.ok && r.ref === 'PM-2026-002', 'PM ref continues the series: ' + r.ref + ' ' + r.error);
ok(r.pm.nextDue === '2027-01-28' && r.pm.status === 'For Monitoring' && r.pm.quarter === 'Q4 2026' && r.pm.timeStart === '9:00 AM', 'pm fields');
ok(r.item.lastPm === '2026-10-28' && r.item.condition === 'For monitoring' && r.item.os === 'Windows 11 Pro', 'masterlist follows the PM');
let g = call({ action: 'getPM', ref: 'PM-2026-002' });
ok(g.ok && g.pm.checks.length === 2 && g.pm.signature === sig, 'getPM returns checks and signature');
ok(be.code.verifyRecords() === 'All PM records match their hash.', 'hash verifies');
// tamper
const pmSheet = be.gas._ss.getSheetByName('PM Log');
const row3 = pmSheet._data[2]; const save = row3[14]; row3[14] = 'Changed by hand';
ok(/CHANGED AFTER SAVING: PM-2026-002/.test(be.code.verifyRecords()), 'tamper detected');
row3[14] = save;

// second PM same unit, occurrence count, next year numbering
r = call({ action: 'savePM', pm: { equipmentId: 'ICT-0030', date: '2027-01-20', personnel: 'Argie R. Lopez', overall: 'Functional', activity: 'Cleaning' }, checks: [] });
ok(r.ok && r.ref === 'PM-2027-001' && r.pm.occurrence === '2', 'new year resets numbering, occurrence 2: ' + r.ref + ' ' + r.pm.occurrence);
ok(r.item.condition === 'Serviceable' && r.item.nextDue === '2027-04-20', 'condition back to serviceable');
// void the latest, masterlist points back
r = call({ action: 'voidPM', ref: 'PM-2027-001', reason: 'wrong unit' });
ok(r.ok, 'void ok');
L = call({ action: 'load' });
const u = L.inventory.find(i => i.id === 'ICT-0030');
ok(u.lastRef === 'PM-2026-002' && u.nextDue === '2027-01-28', 'void restores previous PM: ' + u.lastRef + ' ' + u.nextDue);
ok(!call({ action: 'voidPM', ref: 'PM-2027-001', reason: 'again' }).ok, 'double void refused');
ok(!call({ action: 'voidPM', ref: 'PM-2026-002', reason: '' }).ok, 'void needs reason');

// validation
ok(!call({ action: 'savePM', pm: { equipmentId: 'ICT-0030', date: '2026-10-28', personnel: 'X' } }).ok, 'overall required');
ok(!call({ action: 'savePM', pm: { equipmentId: 'ICT-9999', date: '2026-10-28', personnel: 'X', overall: 'Functional' } }).ok, 'unknown unit');
ok(!call({ action: 'savePM', pm: { equipmentId: 'ICT-0030', date: '2026-10-28', personnel: 'X', overall: 'Functional' }, signature: 'javascript:alert(1)' }).ok, 'bad signature refused');

// disposed units: no next due, no PM
r = call({ action: 'saveEquipment', item: Object.assign({}, u, { condition: 'Disposed' }) });
ok(r.ok && r.item.nextDue === '', 'disposed has no next due');
ok(!call({ action: 'savePM', pm: { equipmentId: 'ICT-0030', date: '2026-10-28', personnel: 'X', overall: 'Functional' } }).ok, 'no PM on disposed');

// hand-pasted row gets an ID
const inv = be.gas._ss.getSheetByName('Inventory');
const IH = inv._data[0];
const blank = IH.map(() => ''); blank[IH.indexOf('Equipment Type')] = 'Printer'; blank[IH.indexOf('Brand / Model')] = 'Brother HL'; blank[IH.indexOf('Office / Section')] = 'HRMO';
inv.getRange(inv._data.length + 1, 1, 1, IH.length).setValues([blank]);
L = call({ action: 'load' });
const b = L.inventory.find(i => i.brand === 'Brother HL');
ok(b && b.id === 'ICT-0031' && b.freq === 'Quarterly' && b.condition === 'Serviceable', 'pasted row normalized: ' + JSON.stringify(b && b.id));

// audit trail
const aud = be.gas._ss.getSheetByName('Audit Trail')._data.map(r => r[2]);
['SETUP', 'EQUIPMENT ADDED', 'EQUIPMENT UPDATED', 'PM RECORDED', 'PM VOIDED', 'VERIFY', 'EQUIPMENT IMPORTED'].forEach(a => ok(aud.includes(a), 'audit has ' + a));

// employees and offices
L = call({ action: 'load' });
ok(L.masterlist.found && L.masterlist.count === 5, 'masterlist read: ' + JSON.stringify(L.masterlist));
const jose = L.employees.find(e => e.surname === undefined && /Reyes Jr\./.test(e.name));
ok(jose && jose.name === 'Jose Mari S. Reyes Jr.' && jose.office === 'Cash Unit' && jose.position === 'Cashier I', 'name, office and position parsed: ' + JSON.stringify(jose));
ok(L.employees.find(e => e.name === 'Juan P. Dela Cruz').office === 'Accounting Section', 'last word is the middle name');
r = call({ action: 'addOffice', name: 'dietary unit' });
ok(r.ok && r.office === 'Dietary Unit', 'office added and tidied: ' + r.office);
ok(call({ action: 'addOffice', name: 'DIETARY  UNIT' }).existed, 'duplicate office not added twice');
ok(call({ action: 'addOffice', name: 'cash unit' }).existed, 'office from masterlist counts as existing');
r = call({ action: 'addEmployee', employee: { name: 'Pedro Penduko', position: 'Job Order', office: 'Motor Pool' } });
ok(r.ok && r.newOffice === 'Motor Pool' && r.employee.office === 'Motor Pool', 'employee added with a new office');
ok(call({ action: 'addEmployee', employee: { name: 'pedro  penduko', office: 'x' } }).existed, 'duplicate employee not added');
ok(call({ action: 'addEmployee', employee: { name: 'maria clara r santos', office: 'Budget Section' } }).existed, 'masterlist employee not added again');
ok(!call({ action: 'addEmployee', employee: { name: 'No Office' } }).ok, 'employee needs an office');
L = call({ action: 'load' });
ok(L.employees.some(e => e.name === 'Pedro Penduko' && e.added) && L.masterlist.added === 1, 'added employee listed');
ok(L.lists.offices.includes('Dietary Unit') && L.lists.offices.includes('Motor Pool'), 'new offices in Lists');
const aud2 = be.gas._ss.getSheetByName('Audit Trail')._data.map(r => r[2]);
ok(aud2.includes('OFFICE ADDED') && aud2.includes('EMPLOYEE ADDED'), 'audit has office and employee adds');

// job orders: public request, ICTU update, numbering, targets, privacy of the public answers
const pub = req => JSON.parse(be.code.api(JSON.stringify(Object.assign({ device: 'phone' }, req))));
let P0 = pub({ action: 'publicInit' });
ok(P0.ok && P0.offices.includes('Cash Unit') && !JSON.stringify(P0).includes('Juan'), 'public init lists sections, no names');
let E = pub({ action: 'eqInfo', id: 'ict-2' });
ok(!E.ok, 'bad code shape refused');
E = pub({ action: 'eqInfo', id: 'ICT-0002' });
ok(E.ok && E.item.id === 'ICT-0002' && E.item.endUser === undefined && E.item.serial === undefined && E.jobs.length === 0, 'eqInfo hides names and serials');
ok(!pub({ action: 'submitJO', jo: { lastName: 'Cruz', unit: 'Cash Unit', description: 'x', types: ['ID printing'] } }).ok, 'first name required');
ok(!pub({ action: 'submitJO', jo: { lastName: 'Cruz', firstName: 'Ana', unit: 'Cash Unit', description: 'x' } }).ok, 'type of request required');
let S = pub({ action: 'submitJO', jo: { lastName: 'Cruz', firstName: 'Ana', mi: 'B', unit: 'Cash Unit', description: 'Printer jams', types: ['Printer / scanner problem'],
  equipmentId: 'ict-0002', urgent: 'Yes', urgentReason: 'Payroll today', consent: true } });
ok(S.ok && /^ICTU-\d{4}-0001$/.test(S.jo), 'first JO number: ' + S.jo + ' ' + S.error);
ok(S.request.equipmentId === 'ICT-0002' && S.request.priority === 'P2 - High' && S.request.status === 'Received' && S.request.model, 'equipment filled, urgent is P2: ' + JSON.stringify(S.request).slice(0, 200));
ok(S.request.target && S.request.target > S.request.logged, 'target set from priority: ' + S.request.logged + ' -> ' + S.request.target);
ok(pub({ action: 'eqInfo', id: 'ICT-0002' }).jobs[0].jo === S.jo, 'open JO shows on the QR page');
ok(!pub({ action: 'saveJO', jo: { jo: S.jo, status: 'Resolved' } }).ok, 'saveJO needs the passcode');
be.gas._props.JO_LAST_2026 = '41';
let S2 = call({ action: 'saveJO', jo: { lastName: 'Lopez', firstName: 'Argie', unit: 'ICTU', description: 'Network check', types: ['LAN / cabling / network point'], priority: 'P4 - Planned' }, by: 'James Adrian M. Elona' });
ok(S2.ok && /-0042$/.test(S2.jo.jo), 'ICTU-logged JO continues from JO_LAST: ' + (S2.jo && S2.jo.jo) + ' ' + S2.error);
r = call({ action: 'saveJO', jo: { jo: S.jo, status: 'In Progress', priority: 'P3 - Normal', classification: 'Simple', service: 'On-site' }, by: 'Argie R. Lopez' });
ok(r.ok && r.jo.status === 'In Progress' && r.jo.receivedBy === 'Argie R. Lopez' && r.jo.receivedAt && !r.jo.finishedAt, 'in progress: received by and time filled');
ok(/Status set to In Progress by Argie R. Lopez/.test(r.jo.history), 'history kept');
r = call({ action: 'saveJO', jo: { jo: S.jo, status: 'Resolved', findings: 'Worn roller', action: 'Cleaned roller', personnel: 'Argie R. Lopez', csmSpeed: 'Very Satisfied' }, by: 'Argie R. Lopez' });
ok(r.ok && r.jo.finishedAt && r.jo.withinTarget === 'Yes', 'resolved now is within target: ' + r.jo.withinTarget);
ok(call({ action: 'saveJO', jo: { jo: S.jo, status: 'Resolved' } }).unchanged, 'unchanged JO save detected');
ok(!call({ action: 'saveJO', jo: { jo: S.jo, status: 'Fixed' } }).ok, 'unknown status refused');
ok(!call({ action: 'saveJO', jo: { jo: S.jo, equipmentId: 'ICT-9999' } }).ok, 'unknown equipment refused');
r = call({ action: 'saveJO', jo: { jo: S2.jo.jo, equipmentId: 'ICT-0003', status: 'Beyond Economical Repair' }, markUnserviceable: true, by: 'James Adrian M. Elona' });
ok(r.ok && r.item && r.item.condition === 'Unserviceable' && r.item.nextDue === '', 'beyond repair marks the unit unserviceable');
L = call({ action: 'load' });
ok(L.jos.length === 2 && L.joForm.code === 'COH-IDN-F-01', 'load returns job orders');
const jl = be.gas._ss.getSheetByName('JO Log');
ok(jl._data[0][0] === 'Date/Time Logged' && jl._data[0][1] === 'JO No.' && jl._data[0].length >= 53, 'JO Log keeps the old column order');
// the old online form still works when pointed here
r = JSON.parse(be.code.doPost({ postData: { contents: JSON.stringify({ key: 'trcd-ictu-jo', kind: 'submit', id: 'abc-1', requested_at: 'Oct 28, 2026  9:05 AM',
  last_name: 'Reyes', first_name: 'Jose', unit: 'Cash Unit', description: 'No internet', types: 'No internet / slow connection; Wi-Fi access', urgent: 'No', consent: 'Yes' }) } }).text);
ok(r.ok && /-0043$/.test(r.jo), 'old form gets the next JO no.: ' + r.jo);
r = JSON.parse(be.code.doPost({ postData: { contents: JSON.stringify({ key: 'trcd-ictu-jo', kind: 'action', id: 'abc-1', action: 'Printed' }) } }).text);
ok(r.ok, 'old form print action logged');
L = call({ action: 'load' });
const old = L.jos.find(j => j.lastName === 'Reyes');
ok(old.requestedAt === '2026-10-28 09:05' && old.types.length === 2 && /Printed/.test(old.history), 'old form fields mapped: ' + old.requestedAt);
// target skips the weekend: Friday 3 PM, P2 (1 working day) -> Monday 3 PM
ok(be.ctx.target_('2026-10-30 15:00', 'P2 - High') === '2026-11-02 15:00', 'P2 target skips the weekend: ' + be.ctx.target_('2026-10-30 15:00', 'P2 - High'));
ok(be.ctx.target_('2026-10-28 09:00', 'P1 - Critical') === '2026-10-28 13:00', 'P1 is 4 hours');
const aud3 = be.gas._ss.getSheetByName('Audit Trail')._data.map(r => r[2]);
ok(aud3.includes('JOB ORDER RECEIVED') && aud3.includes('JOB ORDER UPDATED'), 'audit has job orders');

console.log('backend: ' + n + ' checks passed');
