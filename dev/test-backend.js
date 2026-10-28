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

console.log('backend: ' + n + ' checks passed');
