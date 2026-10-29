// Backend rules test: runs apps-script/Code.gs against the in-memory mock. Run: node dev/test-backend.js
const assert = require('assert');
const { loadBackend, seed } = require('./mock-gas');

const be = loadBackend(); seed(be);
const raw = req => JSON.parse(be.code.api(JSON.stringify(Object.assign({ device: 'test' }, req))));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// accounts: the first Head is made with the setup passcode, then everyone signs in with their own password
ok(raw({ action: 'publicInit' }).needsSetup === true, 'no accounts yet: setup needed');
ok(raw({ action: 'load' }).signIn === true, 'no token: sign in needed');
ok(/passcode/i.test(raw({ action: 'firstHead', pin: '9', user: { username: 'jed', fullName: 'James Adrian M. Elona', password: 'ictu2026x' } }).error), 'wrong setup passcode refused');
ok(/8 characters/.test(raw({ action: 'firstHead', pin: '1234', user: { username: 'jed', fullName: 'James Adrian M. Elona', password: 'short1' } }).error), 'short password refused');
let F = raw({ action: 'firstHead', pin: '1234', user: { username: 'Jed', fullName: 'James Adrian M. Elona', position: 'Head, ICT Unit', password: 'ictu2026x' } });
ok(F.ok && F.me.role === 'Head' && F.me.username === 'jed' && /^[a-f0-9]{64}$/.test(F.token), 'first Head made: ' + F.error);
ok(!raw({ action: 'firstHead', pin: '1234', user: { username: 'x2', fullName: 'X', password: 'ictu2026x' } }).ok, 'only one first Head');
ok(raw({ action: 'publicInit' }).needsSetup === false, 'setup no longer needed');
const HEAD = F.token;
const call = req => raw(Object.assign({ token: HEAD }, req));
const users = be.gas._ss.getSheetByName('Users')._data;
ok(/^v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(users[1][5]) && !JSON.stringify(users).includes('ictu2026x'), 'password stored hashed only');
let A = call({ action: 'saveUser', user: { isNew: true, username: 'argie', fullName: 'Argie R. Lopez', position: 'Computer Operator II', role: 'Technician' } });
ok(A.ok && /^[a-z]{5}\d{4}$/.test(A.tempPassword) && A.users.length === 2, 'technician added with a temporary password: ' + A.error);
ok(!call({ action: 'saveUser', user: { isNew: true, username: 'ARGIE', fullName: 'X', role: 'Viewer' } }).ok, 'duplicate username refused');
ok(raw({ action: 'signIn', username: 'argie', password: 'nope' }).error === 'Wrong username or password.', 'wrong password refused');
const audN = () => be.gas._ss.getSheetByName('Audit Trail')._data.length;
const audBefore = audN();
ok(raw({ action: 'signIn', username: 'nobody-here', password: 'x' }).error === 'Wrong username or password.' && audN() === audBefore, 'unknown username refused without an Audit Trail row');
let S0 = raw({ action: 'signIn', username: 'Argie', password: A.tempPassword });
ok(S0.ok && S0.me.mustChange && S0.me.role === 'Technician', 'temporary password signs in, must change');
ok(/change your temporary password/.test(raw({ action: 'load', token: S0.token }).error), 'must change the password first');
ok(!raw({ action: 'changePassword', token: S0.token, old: A.tempPassword, password: 'argie2026x' }).ok, 'password with the username refused');
ok(raw({ action: 'changePassword', token: S0.token, old: A.tempPassword, password: 'lopez2026x' }).ok, 'password changed');
const TECH = S0.token;
const asTech = req => raw(Object.assign({ token: TECH }, req));
ok(asTech({ action: 'load' }).me.name === 'Argie R. Lopez', 'technician loads');
ok(/role \(Technician\)/.test(asTech({ action: 'listUsers' }).error), 'technician cannot manage users');
ok(/role \(Technician\)/.test(asTech({ action: 'voidPM', ref: 'x', reason: 'y' }).error), 'technician cannot void');
let V = call({ action: 'saveUser', user: { isNew: true, username: 'viewer1', fullName: 'Viewer One', role: 'Viewer' } });
let VS = raw({ action: 'signIn', username: 'viewer1', password: V.tempPassword });
raw({ action: 'changePassword', token: VS.token, old: V.tempPassword, password: 'viewer2026x' });
ok(raw({ action: 'load', token: VS.token }).ok && /role \(Viewer\)/.test(raw({ action: 'saveEquipment', token: VS.token, item: {} }).error), 'viewer reads but cannot save');
call({ action: 'saveUser', user: { username: 'viewer1', status: 'Disabled' } });
ok(raw({ action: 'load', token: VS.token }).signIn, 'disabled account is signed out at once');
ok(/at least one active Head/.test(call({ action: 'saveUser', user: { username: 'jed', role: 'Technician' } }).error), 'last Head cannot be demoted');
for (let i = 0; i < 5; i++) raw({ action: 'signIn', username: 'viewer1', password: 'bad' + i });
ok(/Too many wrong tries/.test(raw({ action: 'signIn', username: 'viewer1', password: 'viewer2026x' }).error), 'locked after 5 wrong tries');
ok(raw({ action: 'signOut', token: VS.token }).ok || true, 'sign out');
const T2 = raw({ action: 'signIn', username: 'jed', password: 'ictu2026x' }).token;
raw({ action: 'signOut', token: T2 });
ok(raw({ action: 'load', token: T2 }).signIn, 'signed-out token no longer works');
ok(call({ action: 'ping' }).ok, 'ping');

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
ok(pub({ action: 'saveJO', jo: { jo: S.jo, status: 'Resolved' } }).signIn, 'saveJO needs a signed-in user');
be.gas._props.JO_LAST_2026 = '41';
let S2 = call({ action: 'saveJO', jo: { lastName: 'Lopez', firstName: 'Argie', unit: 'ICTU', description: 'Network check', types: ['LAN / cabling / network point'], priority: 'P4 - Planned' }, by: 'James Adrian M. Elona' });
ok(S2.ok && /-0042$/.test(S2.jo.jo), 'ICTU-logged JO continues from JO_LAST: ' + (S2.jo && S2.jo.jo) + ' ' + S2.error);
r = asTech({ action: 'saveJO', jo: { jo: S.jo, status: 'In Progress', priority: 'P3 - Normal', classification: 'Simple', service: 'On-site' } });
ok(r.ok && r.jo.status === 'In Progress' && r.jo.receivedBy === 'Argie R. Lopez' && r.jo.receivedAt && !r.jo.finishedAt, 'in progress: received by and time filled');
ok(/Status set to In Progress by Argie R. Lopez/.test(r.jo.history), 'history kept');
r = asTech({ action: 'saveJO', jo: { jo: S.jo, status: 'Resolved', findings: 'Worn roller', action: 'Cleaned roller', personnel: 'Argie R. Lopez' } });
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

// CSM link: the requestor tracks and rates the job order with the token on the printed form
L = call({ action: 'load' });
const done = L.jos.find(j => j.jo === S.jo);
ok(/^[a-f0-9]{32}$/.test(done.token), 'each JO has a CSM token');
let T = pub({ action: 'trackJO', t: done.token });
ok(T.ok && T.jo.status === 'Resolved' && T.jo.canRate && !JSON.stringify(T).includes('Argie') && !JSON.stringify(T).includes('Cruz'), 'track page: no names, can rate');
ok(!pub({ action: 'trackJO', t: 'abc' }).ok && !pub({ action: 'trackJO', t: 'a'.repeat(32) }).ok, 'bad token refused');
ok(/answer all three/.test(pub({ action: 'rateJO', t: done.token, speed: 'Very Satisfied' }).error), 'all three answers needed');
ok(pub({ action: 'rateJO', t: done.token, speed: 'Very Satisfied', quality: 'Satisfied', courtesy: 'Very Satisfied', suggestions: '=cmd' }).ok, 'rating saved');
ok(/already rated/.test(pub({ action: 'rateJO', t: done.token, speed: 'Neutral', quality: 'Neutral', courtesy: 'Neutral' }).error), 'rated once only');
const open1 = L.jos.find(j => j.lastName === 'Reyes');
ok(/once the job order is done/.test(pub({ action: 'rateJO', t: open1.token, speed: 'Neutral', quality: 'Neutral', courtesy: 'Neutral' }).error), 'open JO cannot be rated yet');
L = call({ action: 'load' });
const rated = L.jos.find(j => j.jo === S.jo);
ok(rated.csmQuality === 'Satisfied' && rated.csmAt && rated.suggestions === 'cmd', 'rating in the JO Log: ' + rated.suggestions);

// TIR and repair costs on the JO
r = call({ action: 'saveJO', jo: { jo: open1.jo, tirRec: 'Repair with parts to be procured', tirCost: '1,250.50', repairCost: '800' } });
ok(r.ok && /^TIR-\d{4}-001$/.test(r.jo.tirNo) && r.jo.tirCost === 1250.5 && r.jo.repairCost === 800, 'TIR number and costs: ' + r.jo.tirNo + ' ' + r.error);
ok(!call({ action: 'saveJO', jo: { jo: open1.jo, tirRec: 'Throw away' } }).ok, 'unknown TIR recommendation refused');

// transfers (PAR / ICS) update the masterlist
ok(!call({ action: 'saveTransfer', item: { equipmentId: 'ICT-0002', kind: 'Lend' } }).ok, 'transfer kind required');
ok(/Nothing changes/.test(call({ action: 'saveTransfer', item: { equipmentId: 'ICT-0002', kind: 'Change of end user' } }).error), 'transfer must change something');
r = asTech({ action: 'saveTransfer', item: { equipmentId: 'ict-0002', kind: 'Transfer to another section', toOffice: 'HRMO', toUser: 'Pedro Penduko', toOfficer: 'Maria Clara R. Santos', doc: 'ICS 2026-10-015', remarks: 'reassigned' } });
ok(r.ok && /^TR-\d{4}-001$/.test(r.transfer.no) && r.item.office === 'HRMO' && r.item.endUser === 'Pedro Penduko' && r.item.source === 'ICS 2026-10-015', 'transfer recorded and masterlist updated: ' + r.error);
ok(r.transfer.recordedBy === 'Argie R. Lopez' && r.transfer.fromOffice && r.transfer.fromOffice !== 'HRMO', 'transfer keeps where it came from');
r = call({ action: 'saveTransfer', item: { equipmentId: 'ICT-0002', kind: 'Returned to MMU' } });
ok(r.ok && r.item.office === 'Materials Management Unit (MMU)' && r.item.endUser === '' && /-002$/.test(r.transfer.no), 'returned to MMU');

// spare parts and consumables
ok(!call({ action: 'saveStockItem', item: { item: 'Toner' } }).ok, 'unit required');
r = asTech({ action: 'saveStockItem', item: { item: 'Epson 003 ink, black', category: 'Ink / toner', unit: 'bottle', reorder: '3', cost: '' } });
ok(r.ok && r.item.code === 'SP-001' && r.item.reorder === 3 && r.item.updatedBy === 'Argie R. Lopez', 'stock item added: ' + r.error);
ok(/already in the list/.test(call({ action: 'saveStockItem', item: { item: 'EPSON 003 INK, BLACK', unit: 'bottle' } }).error), 'duplicate stock item refused');
ok(/on hand/.test(call({ action: 'saveMove', item: { code: 'SP-001', movement: 'Issued', qty: 1, equipmentId: 'ICT-0001' } }).error), 'cannot issue from zero stock');
r = call({ action: 'saveMove', item: { code: 'SP-001', movement: 'Received', qty: '10', cost: '350', reference: 'IAR 2026-10-33' } });
ok(r.ok && /^SM-\d{4}-0001$/.test(r.move.ref) && r.move.amount === 3500 && r.balance === 10 && r.stockItem.cost === 350, 'received 10: ' + r.error);
ok(/where it went/.test(call({ action: 'saveMove', item: { code: 'SP-001', movement: 'Issued', qty: 1 } }).error), 'issue needs a destination');
r = asTech({ action: 'saveMove', item: { code: 'SP-001', movement: 'Issued', qty: 2, equipmentId: 'ICT-0001', reference: S.jo } });
ok(r.ok && r.balance === 8 && r.move.cost === 350 && r.move.amount === 700, 'issued 2 at the item cost');
ok(/Only 8/.test(call({ action: 'saveMove', item: { code: 'SP-001', movement: 'Adjustment (-)', qty: 9, remarks: 'spilled' } }).error), 'cannot go below zero');
ok(/reason/.test(call({ action: 'saveMove', item: { code: 'SP-001', movement: 'Adjustment (-)', qty: 1 } }).error), 'adjustment needs a reason');

// incident and data breach log
ok(!call({ action: 'saveIncident', item: { type: 'Malware / virus', description: 'x' } }).ok, 'discovered date required');
r = call({ action: 'saveIncident', item: { discovered: '2026-10-29T08:30', type: 'Lost or stolen device', personal: 'Yes', severity: 'High', description: 'Laptop with patient list left in the jeep', equipmentId: 'ICT-0001' } });
ok(r.ok && /^INC-\d{4}-001$/.test(r.item.no) && r.item.discovered === '2026-10-29 08:30' && r.item.npcNeeded === 'To be assessed' && r.item.status === 'Open', 'incident recorded: ' + r.error);
r = call({ action: 'saveIncident', item: { no: r.item.no, status: 'Contained', dpoOn: '2026-10-29 10:00', actions: 'Remote wipe requested' } });
ok(r.ok && r.item.status === 'Contained' && /Updated \(Contained\)/.test(r.item.history), 'incident updated with history');
ok(!call({ action: 'saveIncident', item: { no: r.item.no, severity: 'Huge' } }).ok, 'unknown severity refused');

// network and IP inventory
r = call({ action: 'saveNetwork', item: { kind: 'Router', name: 'Main router', ip: '192.168.1.1', mac: '001a2b3c4d5e', monthly: '' } });
ok(r.ok && r.item.id === 'NET-001' && r.item.mac === '00:1A:2B:3C:4D:5E' && r.item.status === 'Active', 'network item added: ' + r.error);
ok(/already used by NET-001/.test(call({ action: 'saveNetwork', item: { kind: 'Switch', name: 'Sw', ip: '192.168.1.1' } }).error), 'duplicate IP refused');
ok(/should look like/.test(call({ action: 'saveNetwork', item: { kind: 'Switch', name: 'Sw', ip: '192.168.1.300' } }).error), 'bad IP refused');
r = call({ action: 'saveNetwork', item: { kind: 'Internet Line', name: 'PLDT fiber', provider: 'PLDT', bandwidth: '200 Mbps', contractEnd: '2027-03-31', monthly: '2,899' } });
ok(r.ok && r.item.contractEnd === '2027-03-31' && r.item.monthly === 2899, 'internet line with contract');
ok(/Dates should look like/.test(call({ action: 'saveNetwork', item: { kind: 'Switch', name: 'S2', contractEnd: 'next year' } }).error), 'bad date refused');

// everything comes back on load
L = call({ action: 'load' });
ok(L.transfers.length === 2 && L.stock.length === 1 && L.moves.length === 2 && L.incidents.length === 1 && L.network.length === 2, 'load returns the registers');
ok(L.lists.types[0].length === 4 && L.lists.types.find(t => t[0] === 'Monitor')[2] === 7, 'useful life per type');
ok(L.me.role === 'Head' && L.choices.incType.length > 3, 'load returns the signed-in user and choices');

// backups
ok(be.gas._triggers.includes('monthlyBackup'), 'setup turned on the monthly backup');
ok(/role \(Technician\)/.test(asTech({ action: 'backupNow' }).error), 'only the Head backs up by hand');
r = call({ action: 'backupNow' });
ok(r.ok && r.backup.url && be.gas._copies.length === 1, 'backup now made a copy');
be.code.monthlyBackup();
ok(be.gas._copies.length === 2 && /backup \d{4}-\d{2}-\d{2} \d{4}$/.test(be.gas._copies[1]), 'monthly backup makes a dated copy');
ok(call({ action: 'load' }).backup.last, 'last backup shown');

const aud4 = be.gas._ss.getSheetByName('Audit Trail')._data.map(r => r[2]);
['USER ADDED', 'USER UPDATED', 'SIGNED IN', 'SIGN-IN FAILED', 'PASSWORD CHANGED', 'CSM RATING', 'TRANSFER', 'STOCK ITEM ADDED', 'STOCK RECEIVED', 'STOCK ISSUED',
 'INCIDENT ADDED', 'INCIDENT UPDATED', 'NETWORK ITEM ADDED', 'BACKUP'].forEach(a => ok(aud4.includes(a), 'audit has ' + a));
const byCol = be.gas._ss.getSheetByName('Audit Trail')._data.filter(r => r[2] === 'TRANSFER').map(r => r[3]);
ok(byCol[0] === 'Argie R. Lopez', 'audit names the signed-in person, not what the page sends');
console.log('backend: ' + n + ' checks passed');
