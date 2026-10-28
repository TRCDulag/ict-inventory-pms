/**
 * ICT Inventory and PMS (ICTU) - backend for the "Index" page.
 * Keeps the ICT equipment masterlist, the PMS schedule and the PM records
 * (Form COH-IDN-F-02, ICT Equipment Preventive Maintenance Checklist, Rev. 01),
 * and the ICTU Job Order Log (Form COH-IDN-F-01, ICTU Job Order Request Form, Rev. 01;
 * ADM-HIMS-P-03 ICTU Service Procedure).
 *
 * SETUP (one time, in the "ICT Inventory and PMS Register (ICTU)" Google Sheet):
 *   1. Extensions > Apps Script. Delete what is in Code.gs and paste this whole file.
 *   2. Click + (Add a file) > HTML, name it  Index  (no ".html"), delete what is
 *      there and paste the whole of index.html. Save.
 *   3. Pick "setup" in the function list at the top and click Run. Allow the
 *      permissions. It makes any missing tab, protects the tabs, sets the Manila
 *      time zone, makes the signature folder in Drive and sets the ICTU passcode
 *      to 1234. CHANGE THE PASSCODE: Project Settings (gear) > Script properties >
 *      edit ICTU_PASSCODE.
 *   4. Deploy > New deployment > type: Web app.
 *        Execute as: Me      Who has access: Anyone
 *      Click Deploy and copy the Web app URL (ends in /exec). That is the app link.
 *
 * UPDATING an existing deployment (keeps the same URL):
 *   Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
 *
 * EMPLOYEE NAMES: paste the HR "Masterlist of Employees - Permanent" as it is into a tab named
 * Masterlist (section headings in column A, "Position - SG-n" in B, "SURNAME, FIRST MIDDLE" in C).
 * The app reads it for its employee lists. Staff not on it are added in the app and kept in the
 * Added Employees tab. The masterlist stays in this Sheet only, never on GitHub.
 *
 * ADDING EQUIPMENT IN BULK: paste rows straight into the Inventory tab (leave the
 * Equipment ID blank). The next time the app loads, each new row gets its ID and
 * its Next PM Due, and the Audit Trail notes it.
 *
 * JOB ORDERS: staff file requests on the app's public "Request ICT help" page (no passcode) or by
 * scanning the QR label on the equipment. ICTU logs walk-in and phone requests in the app.
 * Each one gets the next JO No. (ICTU-YYYY-NNNN) in the JO Log tab. To continue the numbers of the
 * old JO Log, either paste its rows into the JO Log tab (same column order), or add a Script
 * property JO_LAST_2026 with the last JO number used this year (for example 37).
 * The old online request form also works with this script: put this /exec link in its SHEET_URL.
 *
 * RECORD CONTROL (ISO 9001:2015 cl. 7.5.3):
 *   - Every tab is protected so only the Sheet owner can edit it by hand; the
 *     page writes through this script, and only with the ICTU passcode.
 *   - Nothing is deleted. A wrong PM record is Voided (with a reason) and kept.
 *     Equipment that leaves service is marked Disposed, not removed.
 *   - Each PM record carries a Record Hash (SHA-256 of the record, its checklist
 *     and its signature). Run "verifyRecords" any time to check them.
 *   - Every change is written to the Audit Trail tab with the server time.
 */

const TZ = 'Asia/Manila';
const SIG_FOLDER = 'ICT PMS Signatures';
const VERSION = '1.2.0';

const FORM = { code: 'COH-IDN-F-02', rev: '01', effectivity: '', title: 'ICT Equipment Preventive Maintenance Checklist' };
const JO_FORM = { code: 'COH-IDN-F-01', rev: '01', effectivity: '', title: 'ICTU Job Order Request Form' };

const INV = 'Inventory', PM = 'PM Log', CHK = 'Checklist Results', AUDIT = 'Audit Trail', LISTS = 'Lists';
const MASTER = 'Masterlist', ADDED = 'Added Employees', JO = 'JO Log';

const INV_HEADERS = ['Equipment ID', 'Property Tag No.', 'Equipment Type', 'Brand / Model', 'Description / Specs',
  'Serial No.', 'Office / Section', 'End User', 'Accountable Officer', 'Source Document (RIS / PAR / ICS)',
  'Date Acquired', 'Unit Cost', 'Warranty Until', 'Computer Name / IP', 'OS Installed', 'MS Office Installed',
  'PM Frequency', 'Last PM', 'Last PM Ref No.', 'Next PM Due', 'Condition', 'Remarks',
  'Added At', 'Updated At', 'Updated By'];

// The first 21 columns are the ones of the ICTU Preventive Maintenance Log workbook, in the same order.
const PM_HEADERS = ['PM Ref No.', 'Date', 'Time Start', 'Time End', 'Quarter', 'Office / Section', 'End User',
  'Equipment Type', 'Brand / Model', 'Serial No.', 'Property Tag No.', 'Under Warranty?', 'Maintenance Type',
  'Issue Identified', 'Action Taken', 'Occurrence No. (same unit & type)', 'Status', 'Remarks',
  'Next Check / PM Due', 'ICT Personnel', 'End User Acknowledged?',
  'Equipment ID', 'PM Type', 'Frequency', 'Overall Status', 'Parts Replaced / Used', 'Computer Name / IP',
  'OS Installed', 'OS License', 'MS Office Installed', 'MS Office License', 'Applications Installed',
  'Acknowledged By (End User)', 'Signature File', 'Verified By (Head, ICT Unit)', 'Logged At', 'Record Status',
  'Record Hash'];

const CHK_HEADERS = ['PM Ref No.', 'Section', 'Check Item', 'Result', 'Note'];
const AUDIT_HEADERS = ['Timestamp', 'Reference', 'Action', 'By', 'Details', 'Device'];
const ADDED_HEADERS = ['Name', 'Position', 'Office / Unit', 'Added By', 'Added At'];

// The first 33 columns are the ones of the old ICTU Job Order Log, in the same order, so its rows can be pasted in.
const JO_HEADERS = ['Date/Time Logged', 'JO No.', 'Status', 'Priority', 'Date/Time of Request',
  'Last Name', 'First Name', 'M.I.', 'Position', 'Section / Unit', 'Contact / Local No.', 'Mode of Request',
  'Equipment / System', 'Brand / Model', 'Property / Serial No.', 'Location',
  'Urgent?', 'Urgent Reason', 'Type(s) of Request', 'Others', 'Brief Description',
  'Section / Unit Head', 'Data Privacy Consent',
  'ICTU Personnel', 'Date/Time Finished', 'Findings / Action Taken', 'Remarks',
  'Last Action', 'Last Action At', 'Print / Share Count', 'Action History', 'Request ID', 'Device',
  'Equipment ID', 'Received By', 'Date/Time Received', 'Date/Time Started', 'Classification', 'Mode of Service',
  'Pulled Out On', 'Returned On', 'Findings / Cause', 'Action Taken', 'Parts Used / Needed', 'Status Note',
  'Target Date/Time', 'Within Target?', 'CSM Speed', 'CSM Quality', 'CSM Courtesy', 'Suggestions',
  'Updated At', 'Updated By'];

const JO_STATUS = ['Received', 'In Progress', 'On Hold', 'Referred', 'Resolved', 'Resolved - temporary fix', 'Beyond Economical Repair', 'Cancelled'];
const JO_CLOSED = ['Resolved', 'Resolved - temporary fix', 'Beyond Economical Repair', 'Cancelled'];
const JO_PRIORITY = ['P1 - Critical', 'P2 - High', 'P3 - Normal', 'P4 - Planned'];
// Target resolution per ADM-HIMS-P-03 section VI: [working hours, working days].
const JO_TARGET = { 'P1': [4, 0], 'P2': [0, 1], 'P3': [0, 3], 'P4': [0, 7] };
const LEGACY_JO_KEY = 'trcd-ictu-jo';   // the key the old online request form sends

const I = idx_(INV_HEADERS), P = idx_(PM_HEADERS), J = idx_(JO_HEADERS);

const FREQ_MONTHS = { 'Monthly': 1, 'Quarterly': 3, 'Semi-Annual': 6, 'Annual': 12 };
const NOT_SCHEDULED = 'Not scheduled (checked with its PC)';

// Overall Status on the form -> Status word used in the PM Log and its Quarterly Summary.
const STATUS_MAP = { 'Functional': 'Resolved', 'Functional, for monitoring': 'For Monitoring',
  'For repair': 'For Repair', 'For replacement / condemnation': 'For Replacement' };

// Used only when the Lists tab is missing or a column is empty.
const DEFAULT_LISTS = {
  types: [['Desktop Computer', 'Quarterly'], ['Laptop', 'Quarterly'], ['Printer', 'Quarterly'], ['Scanner', 'Quarterly'],
    ['Monitor', NOT_SCHEDULED], ['Keyboard / Mouse', NOT_SCHEDULED], ['UPS / AVR', 'Semi-Annual'],
    ['Network Device', 'Semi-Annual'], ['Projector', 'Annual'], ['Peripheral (USB hub, Wi-Fi dongle, etc.)', NOT_SCHEDULED],
    ['Others', 'Annual']],
  offices: ['ABTC', 'Accounting Section', 'Billing Section', 'Budget Section', 'Cash Unit', 'HRMO', 'ICTU',
    'Materials Management Unit (MMU)', 'Office of the TRC Chief', 'Procurement'],
  staff: [['James Adrian M. Elona', 'Head, ICT Unit'], ['Argie R. Lopez', 'Computer Operator II']],
  activities: ['Cleaning', 'Diagnostics', 'Counter Reset / Service Mode', 'Software / OS Update', 'Virus & Malware Check',
    'Backup', 'Network Check', 'Hardware Repair / Replacement', 'Print Test', 'Others'],
  conditions: ['Serviceable', 'For monitoring', 'For repair', 'Unserviceable', 'Disposed']
};

// ---------- web entry points ----------

function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return json_({ ok: true, message: 'ICT Inventory and PMS script is running.', version: VERSION });
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('ICT Inventory and PMS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Used when index.html is opened from a PC or from GitHub Pages (not through the /exec link).
function doPost(e) {
  return json_(handle_(JSON.parse((e && e.postData && e.postData.contents) || '{}')));
}

// Used by the page when it is opened through the /exec link.
function api(reqJson) {
  return JSON.stringify(handle_(JSON.parse(reqJson || '{}')));
}

function handle_(req) {
  try {
    if (req.action === 'ping') return { ok: true, version: VERSION };
    if (req.key === LEGACY_JO_KEY && req.kind) return legacyJO_(req);   // the old online request form
    // Open to everyone: the "Request ICT help" page and the equipment QR labels.
    if (req.action === 'publicInit') return publicInit_();
    if (req.action === 'eqInfo')     return eqInfo_(req.id);
    if (req.action === 'submitJO')   return submitJO_(req);
    checkPin_(req.pin);   // everything else is for ICTU only
    switch (req.action) {
      case 'checkPin':      return { ok: true };
      case 'load':          return load_();
      case 'saveEquipment': return saveEquipment_(req);
      case 'savePM':        return savePM_(req);
      case 'getPM':         return getPM_(req.ref);
      case 'voidPM':        return voidPM_(req);
      case 'addOffice':     return addOffice_(req);
      case 'addEmployee':   return addEmployee_(req);
      case 'saveJO':        return saveJO_(req);
      default:              return { ok: false, error: 'Unknown action.' };
    }
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

// ---------- actions ----------

function load_() {
  normalizeInventory_();
  const inv = readRows_(INV, INV_HEADERS).map(toItem_);
  const pms = readRows_(PM, PM_HEADERS).map(toPM_);
  const emp = employees_();
  const jos = jobSheet_() ? readRows_(JO, JO_HEADERS).map(toJO_) : [];
  return { ok: true, version: VERSION, form: FORM, joForm: JO_FORM, lists: lists_(), inventory: inv, pms: pms, jos: jos, employees: emp.list,
           masterlist: { found: emp.found, count: emp.count, added: emp.added }, today: fmtDate_(new Date()), appUrl: appUrl_() };
}

function saveEquipment_(req) {
  const it = req.item || {};
  const by = clean_(req.by) || 'ICTU';
  if (!clean_(it.type)) throw new Error('Equipment type is required.');
  if (!clean_(it.brand)) throw new Error('Brand / model is required.');
  if (!clean_(it.office)) throw new Error('Office / section is required.');

  return withLock_(() => {
    const sh = sheet_(INV);
    const now = new Date();
    const serial = clean_(it.serial), tag = clean_(it.tag);
    const rows = readRows_(INV, INV_HEADERS);
    rows.forEach(r => {
      if (r[I['Equipment ID']] === it.id) return;
      if (serial && String(r[I['Serial No.']]).toLowerCase() === serial.toLowerCase())
        throw new Error('Serial no. ' + serial + ' is already in the masterlist as ' + r[I['Equipment ID']] + '.');
      if (tag && String(r[I['Property Tag No.']]).toLowerCase() === tag.toLowerCase())
        throw new Error('Property tag ' + tag + ' is already in the masterlist as ' + r[I['Equipment ID']] + '.');
    });

    let r = it.id ? findRow_(sh, it.id) : 0;
    if (it.id && !r) throw new Error('Equipment ' + it.id + ' was not found.');
    const old = r ? sh.getRange(r, 1, 1, INV_HEADERS.length).getValues()[0] : null;
    const row = old ? old.slice() : new Array(INV_HEADERS.length).fill('');

    const set = {
      'Property Tag No.': tag, 'Equipment Type': clean_(it.type), 'Brand / Model': clean_(it.brand),
      'Description / Specs': clean_(it.desc), 'Serial No.': serial, 'Office / Section': clean_(it.office),
      'End User': clean_(it.endUser), 'Accountable Officer': clean_(it.accountable),
      'Source Document (RIS / PAR / ICS)': clean_(it.source), 'Date Acquired': toDate_(it.acquired) || '',
      'Unit Cost': toNum_(it.cost), 'Warranty Until': toDate_(it.warranty) || '',
      'Computer Name / IP': clean_(it.compName), 'OS Installed': clean_(it.os), 'MS Office Installed': clean_(it.office365 || it.msOffice),
      'PM Frequency': clean_(it.freq) || defaultFreq_(clean_(it.type)), 'Condition': clean_(it.condition) || 'Serviceable',
      'Remarks': clean_(it.remarks)
    };
    Object.keys(set).forEach(k => row[I[k]] = set[k]);
    row[I['Next PM Due']] = nextDue_(row[I['Last PM']], row[I['PM Frequency']], row[I['Condition']]);
    row[I['Updated At']] = now;
    row[I['Updated By']] = by;

    let id = it.id;
    if (!r) {
      id = nextEquipmentId_(rows);
      row[I['Equipment ID']] = id;
      row[I['Added At']] = now;
      r = lastRow_(sh) + 1;
      formatInvRow_(sh, r);
      sh.getRange(r, 1, 1, INV_HEADERS.length).setValues([row]);
      audit_(id, 'EQUIPMENT ADDED', by, row[I['Equipment Type']] + ', ' + row[I['Brand / Model']] +
        (serial ? ', S/N ' + serial : '') + ', ' + row[I['Office / Section']], req.device);
    } else {
      const changes = [];
      Object.keys(set).forEach(k => {
        const a = show_(old[I[k]]), b = show_(row[I[k]]);
        if (a !== b) changes.push(k + ': "' + a + '" to "' + b + '"');
      });
      if (!changes.length) return { ok: true, id: id, item: toItem_(row), unchanged: true };
      formatInvRow_(sh, r);
      sh.getRange(r, 1, 1, INV_HEADERS.length).setValues([row]);
      audit_(id, 'EQUIPMENT UPDATED', by, changes.join('; '), req.device);
    }
    return { ok: true, id: id, item: toItem_(row) };
  });
}

function savePM_(req) {
  const p = req.pm || {};
  const checks = Array.isArray(req.checks) ? req.checks : [];
  const need = { equipmentId: 'Equipment', date: 'Date', personnel: 'ICT personnel', overall: 'Overall status' };
  for (const k in need) if (!clean_(p[k])) throw new Error(need[k] + ' is required.');
  if (!STATUS_MAP[p.overall]) throw new Error('Pick an overall status.');
  const sig = String(req.signature || '');
  if (sig && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig)) throw new Error('The signature could not be read. Please sign again.');
  if (sig.length > 400000) throw new Error('The signature is too large. Please clear it and sign again.');

  return withLock_(() => {
    const inv = sheet_(INV), log = sheet_(PM), chk = sheet_(CHK);
    const r = findRow_(inv, p.equipmentId);
    if (!r) throw new Error('Equipment ' + p.equipmentId + ' was not found.');
    const item = inv.getRange(r, 1, 1, INV_HEADERS.length).getValues()[0];
    if (item[I['Condition']] === 'Disposed') throw new Error(p.equipmentId + ' is marked Disposed.');

    const now = new Date(Math.floor(Date.now() / 1000) * 1000);   // whole seconds, so the hash re-checks exactly
    const d = toDate_(p.date) || now;
    const ref = nextPmRef_(log, d);
    const freq = item[I['PM Frequency']];
    const due = toDate_(p.nextDue) || nextDue_(d, freq, condFromOverall_(p.overall)) || '';
    const warranty = item[I['Warranty Until']] instanceof Date && item[I['Warranty Until']] >= d ? 'Yes' : 'No';
    const issues = clean_(p.findings);

    let sigUrl = '';
    if (sig) {
      const blob = Utilities.newBlob(Utilities.base64Decode(sig.split(',')[1]), 'image/png',
        ref + ' - ' + clean_(p.ackBy || item[I['End User']]) + '.png');
      sigUrl = sigFolder_().createFile(blob).getUrl();
    }

    const row = new Array(PM_HEADERS.length).fill('');
    const set = {
      'PM Ref No.': ref, 'Date': d, 'Time Start': clean_(p.timeStart), 'Time End': clean_(p.timeEnd),
      'Quarter': 'Q' + Math.ceil((d.getMonth() + 1) / 3) + ' ' + Utilities.formatDate(d, TZ, 'yyyy'),
      'Office / Section': clean_(p.office) || item[I['Office / Section']], 'End User': clean_(p.endUser) || item[I['End User']],
      'Equipment Type': item[I['Equipment Type']], 'Brand / Model': item[I['Brand / Model']],
      'Serial No.': item[I['Serial No.']], 'Property Tag No.': item[I['Property Tag No.']], 'Under Warranty?': warranty,
      'Maintenance Type': clean_(p.activity) || 'Cleaning', 'Issue Identified': issues || 'None',
      'Action Taken': clean_(p.action), 'Status': STATUS_MAP[p.overall], 'Remarks': clean_(p.remarks),
      'Next Check / PM Due': due, 'ICT Personnel': clean_(p.personnel), 'End User Acknowledged?': clean_(p.ackBy) ? 'Yes' : 'No',
      'Equipment ID': item[I['Equipment ID']], 'PM Type': clean_(p.pmType) || 'Scheduled PM', 'Frequency': freq,
      'Overall Status': p.overall, 'Parts Replaced / Used': clean_(p.parts), 'Computer Name / IP': clean_(p.compName),
      'OS Installed': clean_(p.os), 'OS License': clean_(p.osLicense), 'MS Office Installed': clean_(p.msOffice),
      'MS Office License': clean_(p.msOfficeLicense), 'Applications Installed': clean_(p.apps),
      'Acknowledged By (End User)': clean_(p.ackBy), 'Signature File': sigUrl,
      'Verified By (Head, ICT Unit)': clean_(p.verifiedBy), 'Logged At': now, 'Record Status': 'Valid'
    };
    Object.keys(set).forEach(k => row[P[k]] = set[k]);
    row[P['Occurrence No. (same unit & type)']] = occurrence_(log, row);

    const chkRows = checks.slice(0, 80).map(c => [ref, clean_(c.section), clean_(c.item),
      ['Done', 'Issue', 'N/A'].indexOf(c.result) >= 0 ? c.result : 'N/A', clean_(c.note)]);
    row[P['Record Hash']] = hash_(row, chkRows, sig);

    const lr = lastRow_(log) + 1;
    formatPmRow_(log, lr);
    log.getRange(lr, 1, 1, PM_HEADERS.length).setValues([row]);
    if (chkRows.length) {
      const cr = lastRow_(chk) + 1;
      chk.getRange(cr, 1, chkRows.length, 3).setNumberFormat('@');
      chk.getRange(cr, 1, chkRows.length, CHK_HEADERS.length).setValues(chkRows);
    }

    // The masterlist follows the latest PM.
    const before = item.slice();
    item[I['Last PM']] = d;
    item[I['Last PM Ref No.']] = ref;
    item[I['Next PM Due']] = due;
    item[I['Condition']] = condFromOverall_(p.overall);
    if (clean_(p.compName)) item[I['Computer Name / IP']] = clean_(p.compName);
    if (clean_(p.os)) item[I['OS Installed']] = clean_(p.os);
    if (clean_(p.msOffice)) item[I['MS Office Installed']] = clean_(p.msOffice);
    if (clean_(p.endUser)) item[I['End User']] = clean_(p.endUser);
    if (clean_(p.office)) item[I['Office / Section']] = clean_(p.office);
    item[I['Updated At']] = now;
    item[I['Updated By']] = clean_(p.personnel);
    formatInvRow_(inv, r);
    inv.getRange(r, 1, 1, INV_HEADERS.length).setValues([item]);

    const moved = ['Office / Section', 'End User'].filter(k => show_(before[I[k]]) !== show_(item[I[k]]))
      .map(k => k + ' "' + show_(before[I[k]]) + '" to "' + show_(item[I[k]]) + '"');
    audit_(ref, 'PM RECORDED', clean_(p.personnel), item[I['Equipment ID']] + ' ' + item[I['Brand / Model']] + ', ' +
      p.overall + ', next PM ' + (due ? fmtDate_(due) : 'not scheduled') + (moved.length ? '. Masterlist updated: ' + moved.join('; ') : ''), req.device);
    return { ok: true, ref: ref, pm: toPM_(row), item: toItem_(item) };
  });
}

function getPM_(ref) {
  const sh = sheet_(PM);
  const r = findRow_(sh, ref);
  if (!r) throw new Error('PM record ' + ref + ' was not found.');
  const row = sh.getRange(r, 1, 1, PM_HEADERS.length).getValues()[0];
  const out = toPM_(row);
  out.checks = readRows_(CHK, CHK_HEADERS).filter(c => c[0] === ref)
    .map(c => ({ section: c[1], item: c[2], result: c[3], note: c[4] }));
  const id = String(row[P['Signature File']]).match(/[-\w]{25,}/);
  if (id) {
    try { out.signature = 'data:image/png;base64,' + Utilities.base64Encode(DriveApp.getFileById(id[0]).getBlob().getBytes()); }
    catch (err) { out.signatureError = 'The signature file could not be read.'; }
  }
  return { ok: true, pm: out };
}

function voidPM_(req) {
  const reason = clean_(req.reason);
  if (!reason) throw new Error('A reason is required to void a PM record.');
  return withLock_(() => {
    const sh = sheet_(PM);
    const r = findRow_(sh, req.ref);
    if (!r) throw new Error('PM record ' + req.ref + ' was not found.');
    const row = sh.getRange(r, 1, 1, PM_HEADERS.length).getValues()[0];
    if (row[P['Record Status']] === 'Voided') throw new Error(req.ref + ' is already voided.');
    sh.getRange(r, P['Record Status'] + 1).setValue('Voided');
    sh.getRange(r, P['Remarks'] + 1).setValue((row[P['Remarks']] ? row[P['Remarks']] + ' | ' : '') + 'VOIDED: ' + reason);
    audit_(req.ref, 'PM VOIDED', clean_(req.by) || 'ICTU', reason, req.device);

    // If this was the unit's latest PM, point the masterlist back to the one before it.
    const eq = row[P['Equipment ID']];
    const inv = sheet_(INV), ir = findRow_(inv, eq);
    if (ir) {
      const item = inv.getRange(ir, 1, 1, INV_HEADERS.length).getValues()[0];
      if (item[I['Last PM Ref No.']] === req.ref) {
        const prev = readRows_(PM, PM_HEADERS).filter(x => x[P['Equipment ID']] === eq && x[P['Record Status']] !== 'Voided' && x[P['PM Ref No.']] !== req.ref)
          .sort((a, b) => a[P['Date']] - b[P['Date']]).pop();
        item[I['Last PM']] = prev ? prev[P['Date']] : '';
        item[I['Last PM Ref No.']] = prev ? prev[P['PM Ref No.']] : '';
        item[I['Next PM Due']] = prev ? (prev[P['Next Check / PM Due']] || nextDue_(prev[P['Date']], item[I['PM Frequency']], item[I['Condition']])) : '';
        inv.getRange(ir, 1, 1, INV_HEADERS.length).setValues([item]);
      }
    }
    return { ok: true };
  });
}

function addOffice_(req) {
  const name = officeName_(clean_(req.name));
  if (!name) throw new Error('Type the name of the office.');
  return withLock_(() => {
    const have = allOffices_().filter(o => nameKey_(o) === nameKey_(name))[0];
    if (have) return { ok: true, office: have, existed: true };
    appendOffice_(name);
    audit_('', 'OFFICE ADDED', clean_(req.by) || 'ICTU', name, req.device);
    return { ok: true, office: name };
  });
}

function addEmployee_(req) {
  const e = req.employee || {};
  const name = clean_(e.name).replace(/\s+/g, ' '), position = clean_(e.position);
  let office = officeName_(clean_(e.office));
  if (!name) throw new Error('Type the name of the employee.');
  if (!office) throw new Error('Pick the office of the employee.');
  return withLock_(() => {
    const have = employees_().list.filter(x => nameKey_(x.name) === nameKey_(name))[0];
    if (have) return { ok: true, employee: have, existed: true };
    let newOffice = '';
    const known = allOffices_().filter(o => nameKey_(o) === nameKey_(office))[0];
    if (known) office = known; else { appendOffice_(office); newOffice = office; }
    const sh = SpreadsheetApp.getActive().getSheetByName(ADDED) || makeAddedTab_();
    const r = lastRow_(sh) + 1;
    sh.getRange(r, 1, 1, 3).setNumberFormat('@');
    sh.getRange(r, 1, 1, ADDED_HEADERS.length).setValues([[name, position, office, clean_(req.by) || 'ICTU', new Date()]]);
    sh.getRange(r, 5).setNumberFormat('mmm d, yyyy h:mm am/pm');
    audit_('', 'EMPLOYEE ADDED', clean_(req.by) || 'ICTU', name + (position ? ', ' + position : '') + ', ' + office +
      (newOffice ? ' (new office added)' : ''), req.device);
    return { ok: true, employee: { name: name, position: position, office: office, added: true }, newOffice: newOffice };
  });
}

// Employees from the Masterlist tab (HR format) plus the ones added in the app, sorted by name.
function employees_() {
  const out = [], seen = {};
  let found = false, count = 0, added = 0;
  const ms = SpreadsheetApp.getActive().getSheetByName(MASTER);
  if (ms) {
    found = true;
    const n = lastFilledRow_(ms, 3);
    const rows = ms.getRange(1, 1, n, 3).getValues().map(r => r.map(v => String(v == null ? '' : v).trim()));
    const isHeading = r => r[0] && !r[1] && !r[2];
    const dup = {}; rows.filter(isHeading).forEach(r => { dup[nameKey_(r[0])] = (dup[nameKey_(r[0])] || 0) + 1; });
    let section = '', division = '';
    rows.forEach(r => {
      if (r[2].indexOf(',') > 0) {
        const p = splitName_(r[2]);
        const name = [p.first, p.middle ? p.middle.charAt(0) + '.' : '', p.surname, p.suffix].filter(Boolean).join(' ');
        if (!name || seen[nameKey_(name)]) return;
        seen[nameKey_(name)] = 1; count++;
        out.push({ name: name, position: r[1].replace(/\s*[-–]\s*SG[\s-]*\d+.*$/i, ''), office: section });
      } else if (isHeading(r)) {
        if (/DIVISION/i.test(r[0])) division = officeName_(r[0]);
        section = officeName_(r[0]) + (dup[nameKey_(r[0])] > 1 && division ? ' (' + division + ')' : '');
      }
    });
  }
  const as = SpreadsheetApp.getActive().getSheetByName(ADDED);
  if (as) {
    const n = lastRow_(as);
    if (n >= 2) as.getRange(2, 1, n - 1, 3).getValues().forEach(r => {
      const name = String(r[0]).trim();
      if (!name || seen[nameKey_(name)]) return;
      seen[nameKey_(name)] = 1; added++;
      out.push({ name: name, position: String(r[1]).trim(), office: String(r[2]).trim(), added: true });
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return { list: out, found: found, count: count, added: added };
}

function allOffices_() {
  const seen = {}, out = [];
  lists_().offices.concat(employees_().list.map(e => e.office)).forEach(o => {
    if (o && !seen[nameKey_(o)]) { seen[nameKey_(o)] = 1; out.push(o); }
  });
  return out;
}

// Adds an office under the last one in column C (Office / Section) of the Lists tab.
function appendOffice_(name) {
  const sh = sheet_(LISTS);
  const vals = sh.getRange(1, 3, sh.getMaxRows(), 1).getValues();
  let r = vals.length;
  while (r > 1 && vals[r - 1][0] === '') r--;
  sh.getRange(r + 1, 3).setNumberFormat('@');
  sh.getRange(r + 1, 3).setValue(name);
}

function makeAddedTab_() {
  const sh = SpreadsheetApp.getActive().insertSheet(ADDED);
  sh.getRange(1, 1, 1, ADDED_HEADERS.length).setValues([ADDED_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  protect_(sh);
  return sh;
}

// ---------- job orders (COH-IDN-F-01, ADM-HIMS-P-03) ----------

function jobSheet_() { return SpreadsheetApp.getActive().getSheetByName(JO); }

// What the public "Request ICT help" page needs. Sections only, never staff names.
function publicInit_() {
  return { ok: true, version: VERSION, joForm: JO_FORM, offices: allOffices_().sort(), today: fmtDate_(new Date()) };
}

// What a phone shows after scanning an equipment QR label. No names, serials or costs.
function eqInfo_(id) {
  id = clean_(id).toUpperCase();
  if (!/^ICT-\d{1,6}$/.test(id)) return { ok: false, error: 'That is not an equipment code. Codes look like ICT-0001.' };
  const r = findRow_(sheet_(INV), id);
  if (!r) return { ok: false, error: 'No equipment has the code ' + id + '.' };
  const it = toItem_(sheet_(INV).getRange(r, 1, 1, INV_HEADERS.length).getValues()[0]);
  const jos = jobSheet_() ? readRows_(JO, JO_HEADERS).filter(x => x[J['Equipment ID']] === id).map(toJO_) : [];
  return { ok: true, today: fmtDate_(new Date()), item: { id: it.id, type: it.type, brand: it.brand, office: it.office, condition: it.condition,
    freq: it.freq, lastPm: it.lastPm, nextDue: it.nextDue },
    jobs: jos.filter(j => JO_CLOSED.indexOf(j.status) < 0).map(j => ({ jo: j.jo, status: j.status, logged: j.logged })) };
}

// A request filed on the public page. Gives the next JO No.
function submitJO_(req) {
  const j = req.jo || {};
  const need = { lastName: 'Last name', firstName: 'First name', unit: 'Section / unit', description: 'Brief description' };
  for (const k in need) if (!clean_(j[k])) throw new Error(need[k] + ' is required.');
  if (!(j.types || []).length && !clean_(j.others)) throw new Error('Pick at least one type of request, or describe it under Others.');
  if (j.urgent === 'Yes' && !clean_(j.urgentReason)) throw new Error('Say why it is urgent.');
  throttle_();
  return withLock_(() => {
    const out = createJO_(j, 'Submitted on the request page', 'Requestor', req.device);
    return { ok: true, jo: out.jo, request: out.record };
  });
}

// The ICTU side: a new job order logged by ICTU, or an update of one (Part II, status, feedback).
function saveJO_(req) {
  const j = req.jo || {};
  const by = clean_(req.by) || 'ICTU';
  return withLock_(() => {
    if (!j.jo) {
      const need = { lastName: 'Last name of the requestor', unit: 'Section / unit', description: 'Brief description' };
      for (const k in need) if (!clean_(j[k])) throw new Error(need[k] + ' is required.');
      const out = createJO_(j, 'Logged by ICTU', by, req.device);
      return finishSave_(out.row, out.r, j, by, req, true);
    }
    const sh = jobSheet_();
    const r = sh ? findCol_(sh, J['JO No.'] + 1, j.jo) : 0;
    if (!r) throw new Error('Job order ' + j.jo + ' was not found.');
    const row = sh.getRange(r, 1, 1, JO_HEADERS.length).getValues()[0];
    return finishSave_(row, r, j, by, req, false);
  });
}

function finishSave_(row, r, j, by, req, isNew) {
  const sh = jobSheet_();
  const old = row.slice();
  const now = new Date();
  const set = {};
  // Part I can be corrected by ICTU.
  const partI = { 'Last Name': 'lastName', 'First Name': 'firstName', 'M.I.': 'mi', 'Position': 'position', 'Section / Unit': 'unit',
    'Contact / Local No.': 'contact', 'Mode of Request': 'mode', 'Equipment / System': 'equipment', 'Brand / Model': 'model',
    'Property / Serial No.': 'serial', 'Location': 'location', 'Urgent Reason': 'urgentReason', 'Others': 'others',
    'Brief Description': 'description', 'Section / Unit Head': 'unitHead',
    // Part II and III
    'Received By': 'receivedBy', 'Classification': 'classification', 'Mode of Service': 'service', 'Findings / Cause': 'findings',
    'Action Taken': 'action', 'Parts Used / Needed': 'parts', 'Status Note': 'statusNote', 'Remarks': 'remarks',
    'ICTU Personnel': 'personnel', 'CSM Speed': 'csmSpeed', 'CSM Quality': 'csmQuality', 'CSM Courtesy': 'csmCourtesy', 'Suggestions': 'suggestions' };
  Object.keys(partI).forEach(h => { if (j[partI[h]] !== undefined) set[h] = clean_(j[partI[h]]); });
  ['Date/Time Received', 'Date/Time Started', 'Date/Time Finished'].forEach((h, i) => {
    const k = ['receivedAt', 'startedAt', 'finishedAt'][i];
    if (j[k] !== undefined) set[h] = dt_(j[k]);
  });
  ['Pulled Out On', 'Returned On'].forEach((h, i) => { const k = ['pulledOut', 'returnedOn'][i]; if (j[k] !== undefined) set[h] = dt_(j[k]); });
  if (j.urgent !== undefined) set['Urgent?'] = j.urgent === 'Yes' ? 'Yes' : 'No';
  if (j.types !== undefined) set['Type(s) of Request'] = (j.types || []).map(clean_).filter(Boolean).join('; ');
  if (j.consent !== undefined) set['Data Privacy Consent'] = j.consent ? 'Yes' : 'No';
  if (j.priority !== undefined) {
    const p = clean_(j.priority);
    if (p && JO_PRIORITY.indexOf(p) < 0) throw new Error('Pick a priority from the list.');
    set['Priority'] = p;
  }
  if (j.status !== undefined) {
    if (JO_STATUS.indexOf(j.status) < 0) throw new Error('Pick a status from the list.');
    set['Status'] = j.status;
  }
  if (j.equipmentId !== undefined) {
    const eq = clean_(j.equipmentId).toUpperCase();
    if (eq && !findRow_(sheet_(INV), eq)) throw new Error('Equipment ' + eq + ' is not in the masterlist.');
    set['Equipment ID'] = eq;
  }
  Object.keys(set).forEach(h => row[J[h]] = set[h]);

  const status = row[J['Status']];
  const closed = JO_CLOSED.indexOf(status) >= 0;
  if (closed && !row[J['Date/Time Finished']]) row[J['Date/Time Finished']] = dt_(now);
  if (!closed) row[J['Date/Time Finished']] = row[J['Date/Time Finished']] && j.finishedAt ? row[J['Date/Time Finished']] : '';
  if (status !== 'Received' && !row[J['Date/Time Received']]) row[J['Date/Time Received']] = dt_(now);
  if (!row[J['Received By']] && status !== 'Received') row[J['Received By']] = by;
  row[J['Target Date/Time']] = target_(row[J['Date/Time Logged']], row[J['Priority']]);
  row[J['Within Target?']] = closed && status !== 'Cancelled' && row[J['Target Date/Time']]
    ? (parseDt_(row[J['Date/Time Finished']]) <= parseDt_(row[J['Target Date/Time']]) ? 'Yes' : 'No') : '';
  row[J['Findings / Action Taken']] = [row[J['Findings / Cause']], row[J['Action Taken']]].filter(Boolean).join(' / ');

  const changes = [];
  JO_HEADERS.forEach((h, i) => {
    if (['Updated At', 'Updated By', 'Action History', 'Last Action', 'Last Action At', 'Findings / Action Taken', 'Target Date/Time', 'Within Target?'].indexOf(h) >= 0) return;
    if (show_(old[i]) !== show_(row[i]) && !isNew) changes.push(h + ': "' + show_(old[i]).slice(0, 60) + '" to "' + show_(row[i]).slice(0, 60) + '"');
  });
  if (!isNew && !changes.length) return { ok: true, unchanged: true, jo: toJO_(row) };
  const stamp = dt_(now);
  if (!isNew) {
    const what = set['Status'] !== undefined && show_(old[J['Status']]) !== status ? 'Status set to ' + status : 'Updated';
    row[J['Last Action']] = what + ' by ' + by;
    row[J['Last Action At']] = stamp;
    row[J['Action History']] = (String(row[J['Action History']] || '') + '\n' + stamp + ' - ' + what + ' by ' + by).replace(/^\n/, '').slice(-3000);
  }
  row[J['Updated At']] = stamp;
  row[J['Updated By']] = by;
  formatJoRow_(sh, r);
  sh.getRange(r, 1, 1, JO_HEADERS.length).setValues([row.map(v => v == null ? '' : v)]);
  if (!isNew) audit_(row[J['JO No.']], 'JOB ORDER UPDATED', by, changes.join('; '), req.device);

  // A unit found beyond economical repair leaves the PMS schedule (it stays in the masterlist).
  let item = null;
  const eq = row[J['Equipment ID']];
  if (eq && status === 'Beyond Economical Repair' && req.markUnserviceable) {
    const inv = sheet_(INV), ir = findRow_(inv, eq);
    const it = inv.getRange(ir, 1, 1, INV_HEADERS.length).getValues()[0];
    if (it[I['Condition']] !== 'Unserviceable' && it[I['Condition']] !== 'Disposed') {
      it[I['Condition']] = 'Unserviceable'; it[I['Next PM Due']] = ''; it[I['Updated At']] = now; it[I['Updated By']] = by;
      it[I['Remarks']] = (it[I['Remarks']] ? it[I['Remarks']] + '. ' : '') + 'Beyond economical repair per ' + row[J['JO No.']];
      formatInvRow_(inv, ir);
      inv.getRange(ir, 1, 1, INV_HEADERS.length).setValues([it]);
      audit_(eq, 'EQUIPMENT UPDATED', by, 'Condition set to Unserviceable (beyond economical repair, ' + row[J['JO No.']] + ').', req.device);
    }
    item = toItem_(it);
  }
  return { ok: true, jo: toJO_(row), item: item };
}

// Writes a new JO Log row. Fills the equipment fields from the masterlist when an Equipment ID is given.
function createJO_(j, how, by, device) {
  const sh = jobSheet_() || makeJoTab_();
  const now = new Date();
  const no = nextJoNo_(sh, now);
  const row = new Array(JO_HEADERS.length).fill('');
  const eqId = clean_(j.equipmentId).toUpperCase();
  let it = null;
  if (eqId) {
    const ir = findRow_(sheet_(INV), eqId);
    if (ir) it = toItem_(sheet_(INV).getRange(ir, 1, 1, INV_HEADERS.length).getValues()[0]);
  }
  const stamp = dt_(now);
  const urgent = j.urgent === 'Yes';
  const set = {
    'Date/Time Logged': stamp, 'JO No.': no, 'Status': 'Received',
    'Priority': JO_PRIORITY.indexOf(clean_(j.priority)) >= 0 ? clean_(j.priority) : (urgent ? 'P2 - High' : ''),
    'Date/Time of Request': dt_(j.requestedAt) || stamp, 'Last Name': clean_(j.lastName), 'First Name': clean_(j.firstName),
    'M.I.': clean_(j.mi), 'Position': clean_(j.position), 'Section / Unit': clean_(j.unit), 'Contact / Local No.': clean_(j.contact),
    'Mode of Request': clean_(j.mode) || 'Walk-in',
    'Equipment / System': clean_(j.equipment) || (it ? it.type : ''), 'Brand / Model': clean_(j.model) || (it ? it.brand : ''),
    'Property / Serial No.': clean_(j.serial) || (it ? [it.tag, it.serial].filter(Boolean).join(' / ') : ''),
    'Location': clean_(j.location) || (it ? it.office : ''),
    'Urgent?': urgent ? 'Yes' : 'No', 'Urgent Reason': clean_(j.urgentReason),
    'Type(s) of Request': (j.types || []).map(clean_).filter(Boolean).join('; '), 'Others': clean_(j.others),
    'Brief Description': clean_(j.description).slice(0, 600), 'Section / Unit Head': clean_(j.unitHead),
    'Data Privacy Consent': j.consent ? 'Yes' : 'No', 'Last Action': how, 'Last Action At': stamp,
    'Print / Share Count': 0, 'Action History': stamp + ' - ' + how, 'Request ID': clean_(j.requestId) || Utilities.getUuid(),
    'Device': String(device || '').slice(0, 180), 'Equipment ID': it ? it.id : '', 'Updated At': stamp, 'Updated By': by
  };
  Object.keys(set).forEach(h => row[J[h]] = set[h]);
  row[J['Target Date/Time']] = target_(stamp, row[J['Priority']]);
  const r = lastRow_(sh) + 1;
  formatJoRow_(sh, r);
  sh.getRange(r, 1, 1, JO_HEADERS.length).setValues([row]);
  audit_(no, 'JOB ORDER RECEIVED', by, how + '. ' + set['Section / Unit'] + (it ? ', ' + it.id + ' ' + it.brand : '') + ': ' +
    set['Brief Description'].slice(0, 120), device);
  return { jo: no, row: row, r: r, record: toJO_(row) };
}

// The old "ICTU Job Order Request (Online Form).html" posts here when its SHEET_URL is this script's /exec link.
function legacyJO_(p) {
  return withLock_(() => {
    const sh = jobSheet_() || makeJoTab_();
    const r = p.id ? findCol_(sh, J['Request ID'] + 1, String(p.id)) : 0;
    const stamp = dt_(new Date());
    if (p.kind === 'action' || r) {
      if (!r) return { ok: false, error: 'Request not found' };
      const row = sh.getRange(r, 1, 1, JO_HEADERS.length).getValues()[0];
      const a = clean_(p.action).slice(0, 60) || 'Re-submitted';
      row[J['Last Action']] = a; row[J['Last Action At']] = stamp;
      if (/print|share|pdf/i.test(a)) row[J['Print / Share Count']] = Number(row[J['Print / Share Count']] || 0) + 1;
      row[J['Action History']] = (String(row[J['Action History']] || '') + '\n' + stamp + ' - ' + a).replace(/^\n/, '').slice(-3000);
      sh.getRange(r, 1, 1, JO_HEADERS.length).setValues([row]);
      return { ok: true, jo: row[J['JO No.']] };
    }
    if (!clean_(p.last_name) || !clean_(p.unit) || !clean_(p.description)) return { ok: false, error: 'Missing name, unit or description' };
    throttle_();
    const out = createJO_({ requestId: p.id, requestedAt: p.requested_at, lastName: p.last_name, firstName: p.first_name, mi: p.mi,
      position: p.position, unit: p.unit, contact: p.contact, mode: p.mode, equipment: p.equipment, model: p.model, serial: p.serial,
      location: p.location, urgent: p.urgent, urgentReason: p.urgent_reason, types: String(p.types || '').split(/;\s*/),
      others: p.others, description: p.description, unitHead: p.unit_head, consent: p.consent === 'Yes' },
      'Submitted on the old online form', 'Requestor', p.device);
    return { ok: true, jo: out.jo };
  });
}

// ICTU-YYYY-NNNN, per calendar year. Continues from the JO Log rows, or from Script property JO_LAST_YYYY.
function nextJoNo_(sh, now) {
  const year = Utilities.formatDate(now, TZ, 'yyyy');
  const prefix = 'ICTU-' + year + '-';
  let max = Number(PropertiesService.getScriptProperties().getProperty('JO_LAST_' + year) || 0) || 0;
  const n = lastRow_(sh);
  if (n >= 2) sh.getRange(2, J['JO No.'] + 1, n - 1, 1).getValues().forEach(v => {
    const s = String(v[0]);
    if (s.indexOf(prefix) === 0) max = Math.max(max, parseInt(s.slice(prefix.length), 10) || 0);
  });
  return prefix + String(max + 1).padStart(4, '0');
}

// Target date/time from the time logged and the priority: P1 4 working hours, P2 1, P3 3, P4 7 working days.
function target_(logged, priority) {
  const t = JO_TARGET[String(priority || '').slice(0, 2)];
  const d = parseDt_(logged);
  if (!t || !d) return '';
  const wd = x => new Date(x.getTime() + 8 * 3600e3).getUTCDay();   // day of week in Manila
  let out = new Date(d.getTime());
  if (t[0]) out = new Date(out.getTime() + t[0] * 3600e3);
  for (let i = 0; i < t[1];) { out = new Date(out.getTime() + 864e5); if (wd(out) !== 0 && wd(out) !== 6) i++; }
  while (wd(out) === 0 || wd(out) === 6) out = new Date(out.getTime() + 864e5);
  return dt_(out);
}

// At most 30 public requests a minute for the whole app, so a stuck page or a prank cannot flood the log.
function throttle_() {
  if (typeof CacheService === 'undefined') return;
  const c = CacheService.getScriptCache(), k = 'jo-rate-' + Math.floor(Date.now() / 60000);
  const n = Number(c.get(k) || 0) + 1;
  if (n > 30) throw new Error('Too many requests right now. Please wait a minute and try again.');
  c.put(k, String(n), 120);
}

function makeJoTab_() {
  const sh = SpreadsheetApp.getActive().insertSheet(JO);
  sh.getRange(1, 1, 1, JO_HEADERS.length).setValues([JO_HEADERS]).setFontWeight('bold');
  sh.setFrozenRows(1);
  protect_(sh);
  return sh;
}

function formatJoRow_(sh, r) {
  sh.getRange(r, 1, 1, JO_HEADERS.length).setNumberFormat('@');
  sh.getRange(r, J['Print / Share Count'] + 1).setNumberFormat('0');
}

function toJO_(r) {
  const g = h => show_(r[J[h]]);
  return {
    jo: g('JO No.'), logged: dtText_(r[J['Date/Time Logged']]), status: g('Status') || 'Received', priority: g('Priority').replace(/\s*[–-]\s*/, ' - '),
    requestedAt: dtText_(r[J['Date/Time of Request']]), lastName: g('Last Name'), firstName: g('First Name'), mi: g('M.I.'),
    position: g('Position'), unit: g('Section / Unit'), contact: g('Contact / Local No.'), mode: g('Mode of Request'),
    equipment: g('Equipment / System'), model: g('Brand / Model'), serial: g('Property / Serial No.'), location: g('Location'),
    urgent: g('Urgent?'), urgentReason: g('Urgent Reason'), types: g('Type(s) of Request') ? g('Type(s) of Request').split(/;\s*/) : [],
    others: g('Others'), description: g('Brief Description'), unitHead: g('Section / Unit Head'), consent: g('Data Privacy Consent') === 'Yes',
    personnel: g('ICTU Personnel'), finishedAt: dtText_(r[J['Date/Time Finished']]), remarks: g('Remarks'), history: g('Action History'),
    equipmentId: g('Equipment ID'), receivedBy: g('Received By'), receivedAt: dtText_(r[J['Date/Time Received']]),
    startedAt: dtText_(r[J['Date/Time Started']]), classification: g('Classification'), service: g('Mode of Service'),
    pulledOut: dtText_(r[J['Pulled Out On']]), returnedOn: dtText_(r[J['Returned On']]),
    findings: g('Findings / Cause') || (g('Action Taken') ? '' : g('Findings / Action Taken')), action: g('Action Taken'),
    parts: g('Parts Used / Needed'), statusNote: g('Status Note'), target: dtText_(r[J['Target Date/Time']]), withinTarget: g('Within Target?'),
    csmSpeed: g('CSM Speed'), csmQuality: g('CSM Quality'), csmCourtesy: g('CSM Courtesy'), suggestions: g('Suggestions'),
    updatedAt: dtText_(r[J['Updated At']]), updatedBy: g('Updated By')
  };
}

// Date/times in the JO Log are text "yyyy-MM-dd HH:mm" (the same as the old log), Manila time.
function dt_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm');
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3] + (m[4] ? ' ' + ('0' + m[4]).slice(-2) + ':' + m[5] : ' 00:00');
  // The old form sends "Oct 28, 2026  9:05 AM".
  m = s.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})\s+(\d{1,2}):(\d{2}) ([AP]M)$/);
  if (m) {
    const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m[1]) + 1;
    let h = +m[4] % 12 + (m[6] === 'PM' ? 12 : 0);
    if (mo) return m[3] + '-' + ('0' + mo).slice(-2) + '-' + ('0' + m[2]).slice(-2) + ' ' + ('0' + h).slice(-2) + ':' + m[5];
  }
  return clean_(s);
}
function dtText_(v) { return v instanceof Date ? dt_(v) : String(v == null ? '' : v); }
function parseDt_(v) {
  const s = dt_(v);
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? Utilities.parseDate(s, TZ, 'yyyy-MM-dd HH:mm') : null;
}

function findCol_(sh, col, key) {
  const n = lastRow_(sh);
  if (!key || n < 2) return 0;
  const vals = sh.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(key)) return i + 2;
  return 0;
}

// ---------- one-time setup and checks (run from the editor) ----------

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  [[INV, INV_HEADERS], [PM, PM_HEADERS], [CHK, CHK_HEADERS], [AUDIT, AUDIT_HEADERS], [JO, JO_HEADERS]].forEach(([name, h]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    // Writes the header row when it is missing, and adds new columns to an older tab (such as a pasted JO Log).
    const have = sh.getRange(1, 1, 1, h.length).getValues()[0];
    if (have[0] !== h[0] || have.some((v, i) => v !== h[i])) {
      sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  if (!ss.getSheetByName(LISTS)) {
    const sh = ss.insertSheet(LISTS);
    const L = DEFAULT_LISTS, n = Math.max(L.types.length, L.offices.length, L.staff.length, L.activities.length, L.conditions.length);
    const rows = [['Equipment Type', 'Default PM Frequency', 'Office / Section', 'ICT Personnel', 'Position', 'Maintenance Type', 'Condition']];
    for (let i = 0; i < n; i++) rows.push([(L.types[i] || [])[0] || '', (L.types[i] || [])[1] || '', L.offices[i] || '',
      (L.staff[i] || [])[0] || '', (L.staff[i] || [])[1] || '', L.activities[i] || '', L.conditions[i] || '']);
    sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }
  if (!ss.getSheetByName(ADDED)) makeAddedTab_();
  ss.getSheets().forEach(protect_);
  sigFolder_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ICTU_PASSCODE')) props.setProperty('ICTU_PASSCODE', '1234');
  normalizeInventory_();
  audit_('', 'SETUP', Session.getEffectiveUser().getEmail(), 'Setup run; tabs protected. Version ' + VERSION + '.', 'Apps Script editor');
}

// Recomputes the hash of every valid PM record and lists any that don't match.
function verifyRecords() {
  const rows = readRows_(PM, PM_HEADERS);
  const checks = readRows_(CHK, CHK_HEADERS);
  const bad = [];
  rows.forEach((row, i) => {
    if (row[P['Record Status']] !== 'Valid' || !row[P['Record Hash']]) return;
    const ref = row[P['PM Ref No.']];
    const id = String(row[P['Signature File']]).match(/[-\w]{25,}/);
    let sig = '';
    if (id) { try { sig = 'data:image/png;base64,' + Utilities.base64Encode(DriveApp.getFileById(id[0]).getBlob().getBytes()); } catch (err) {} }
    if (hash_(row, checks.filter(c => c[0] === ref), sig) !== row[P['Record Hash']]) bad.push(ref + ' (row ' + (i + 2) + ')');
  });
  const msg = bad.length ? 'CHANGED AFTER SAVING: ' + bad.join(', ') : 'All PM records match their hash.';
  audit_('', 'VERIFY', Session.getEffectiveUser().getEmail(), msg, 'Apps Script editor');
  Logger.log(msg);
  return msg;
}

// ---------- helpers ----------

// Rows pasted into the Inventory tab by hand get an Equipment ID and a Next PM Due.
function normalizeInventory_() {
  const sh = sheet_(INV);
  const n = lastFilledRow_(sh, INV_HEADERS.length);
  if (n < 2) return;
  const data = sh.getRange(2, 1, n - 1, INV_HEADERS.length).getValues();
  const todo = data.map((r, i) => i).filter(i => !data[i][I['Equipment ID']] && data[i].some(v => v !== ''));
  const dueTodo = data.map((r, i) => i).filter(i => data[i][I['Equipment ID']] && data[i][I['Last PM']] instanceof Date && !data[i][I['Next PM Due']]);
  if (!todo.length && !dueTodo.length) return;
  withLock_(() => {
    const fresh = sh.getRange(2, 1, n - 1, INV_HEADERS.length).getValues();
    const added = [];
    fresh.forEach((r, i) => {
      if (!r.some(v => v !== '')) return;
      let changed = false;
      if (!r[I['Equipment ID']]) {
        r[I['Equipment ID']] = nextEquipmentId_(fresh);
        if (!r[I['PM Frequency']]) r[I['PM Frequency']] = defaultFreq_(r[I['Equipment Type']]);
        if (!r[I['Condition']]) r[I['Condition']] = 'Serviceable';
        if (!r[I['Added At']]) r[I['Added At']] = new Date();
        added.push(r[I['Equipment ID']]);
        changed = true;
      }
      if (r[I['Last PM']] instanceof Date && !r[I['Next PM Due']]) {
        r[I['Next PM Due']] = nextDue_(r[I['Last PM']], r[I['PM Frequency']], r[I['Condition']]);
        changed = true;
      }
      if (changed) sh.getRange(i + 2, 1, 1, INV_HEADERS.length).setValues([r]);
    });
    if (added.length) audit_(added[0] + (added.length > 1 ? ' to ' + added[added.length - 1] : ''), 'EQUIPMENT IMPORTED',
      'Sheet', added.length + ' row(s) typed or pasted into the Inventory tab were given an Equipment ID.', 'Google Sheet');
  });
}

function lists_() {
  const out = JSON.parse(JSON.stringify(DEFAULT_LISTS));
  const sh = SpreadsheetApp.getActive().getSheetByName(LISTS);
  if (!sh) return out;
  const n = lastFilledRow_(sh, 7);
  if (n < 2) return out;
  const v = sh.getRange(2, 1, n - 1, 7).getValues();
  const col = c => v.map(r => String(r[c]).trim()).filter(Boolean);
  const types = v.filter(r => String(r[0]).trim()).map(r => [String(r[0]).trim(), String(r[1]).trim() || 'Annual']);
  const staff = v.filter(r => String(r[3]).trim()).map(r => [String(r[3]).trim(), String(r[4]).trim()]);
  if (types.length) out.types = types;
  if (col(2).length) out.offices = col(2);
  if (staff.length) out.staff = staff;
  if (col(5).length) out.activities = col(5);
  if (col(6).length) out.conditions = col(6);
  return out;
}

function defaultFreq_(type) {
  const t = lists_().types.filter(x => x[0] === type)[0];
  return t ? t[1] : 'Annual';
}

function nextDue_(last, freq, condition) {
  const m = FREQ_MONTHS[freq];
  if (!m || !(last instanceof Date) || condition === 'Disposed' || condition === 'Unserviceable') return '';
  const d = new Date(last.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + m);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}

function condFromOverall_(o) {
  return { 'Functional': 'Serviceable', 'Functional, for monitoring': 'For monitoring', 'For repair': 'For repair',
           'For replacement / condemnation': 'Unserviceable' }[o] || 'Serviceable';
}

function nextEquipmentId_(rows) {
  let max = 0;
  rows.forEach(r => { const m = String(r[I['Equipment ID']]).match(/^ICT-(\d+)$/); if (m) max = Math.max(max, +m[1]); });
  return 'ICT-' + String(max + 1).padStart(4, '0');
}

// PM-YYYY-NNN, numbered per calendar year, continuing the ICTU PM Log series.
function nextPmRef_(sh, d) {
  const prefix = 'PM-' + Utilities.formatDate(d, TZ, 'yyyy') + '-';
  let max = 0;
  const n = lastRow_(sh);
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getValues().forEach(v => {
    const s = String(v[0]);
    if (s.indexOf(prefix) === 0) max = Math.max(max, parseInt(s.slice(prefix.length), 10) || 0);
  });
  return prefix + String(max + 1).padStart(3, '0');
}

// Same rule as the old log's formula: how many times this unit has had this maintenance type at this office.
function occurrence_(sh, row) {
  const key = r => [r[P['Office / Section']], r[P['Brand / Model']], r[P['Serial No.']], r[P['Maintenance Type']]].map(show_).join('|');
  const k = key(row);
  return readRows_(PM, PM_HEADERS).filter(r => r[P['Record Status']] !== 'Voided' && key(r) === k).length + 1;
}

function readRows_(name, headers) {
  const sh = sheet_(name);
  const n = lastRow_(sh);
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, headers.length).getValues().filter(r => r[0] !== '');
}

function toItem_(r) {
  return {
    id: r[I['Equipment ID']], tag: show_(r[I['Property Tag No.']]), type: show_(r[I['Equipment Type']]),
    brand: show_(r[I['Brand / Model']]), desc: show_(r[I['Description / Specs']]), serial: show_(r[I['Serial No.']]),
    office: show_(r[I['Office / Section']]), endUser: show_(r[I['End User']]), accountable: show_(r[I['Accountable Officer']]),
    source: show_(r[I['Source Document (RIS / PAR / ICS)']]), acquired: fmtDate_(r[I['Date Acquired']]),
    cost: r[I['Unit Cost']] === '' ? '' : Number(r[I['Unit Cost']]) || '', warranty: fmtDate_(r[I['Warranty Until']]),
    compName: show_(r[I['Computer Name / IP']]), os: show_(r[I['OS Installed']]), msOffice: show_(r[I['MS Office Installed']]),
    freq: show_(r[I['PM Frequency']]), lastPm: fmtDate_(r[I['Last PM']]), lastRef: show_(r[I['Last PM Ref No.']]),
    nextDue: fmtDate_(r[I['Next PM Due']]), condition: show_(r[I['Condition']]) || 'Serviceable', remarks: show_(r[I['Remarks']]),
    updatedAt: fmt_(r[I['Updated At']]), updatedBy: show_(r[I['Updated By']])
  };
}

function toPM_(r) {
  return {
    ref: r[P['PM Ref No.']], date: fmtDate_(r[P['Date']]), timeStart: show_(r[P['Time Start']]), timeEnd: show_(r[P['Time End']]),
    quarter: show_(r[P['Quarter']]), office: show_(r[P['Office / Section']]), endUser: show_(r[P['End User']]),
    type: show_(r[P['Equipment Type']]), brand: show_(r[P['Brand / Model']]), serial: show_(r[P['Serial No.']]),
    tag: show_(r[P['Property Tag No.']]), warranty: show_(r[P['Under Warranty?']]), activity: show_(r[P['Maintenance Type']]),
    findings: show_(r[P['Issue Identified']]), action: show_(r[P['Action Taken']]),
    occurrence: show_(r[P['Occurrence No. (same unit & type)']]), status: show_(r[P['Status']]), remarks: show_(r[P['Remarks']]),
    nextDue: fmtDate_(r[P['Next Check / PM Due']]), personnel: show_(r[P['ICT Personnel']]), ack: show_(r[P['End User Acknowledged?']]),
    equipmentId: show_(r[P['Equipment ID']]), pmType: show_(r[P['PM Type']]), freq: show_(r[P['Frequency']]),
    overall: show_(r[P['Overall Status']]), parts: show_(r[P['Parts Replaced / Used']]), compName: show_(r[P['Computer Name / IP']]),
    os: show_(r[P['OS Installed']]), osLicense: show_(r[P['OS License']]), msOffice: show_(r[P['MS Office Installed']]),
    msOfficeLicense: show_(r[P['MS Office License']]), apps: show_(r[P['Applications Installed']]),
    ackBy: show_(r[P['Acknowledged By (End User)']]), hasSignature: !!r[P['Signature File']],
    verifiedBy: show_(r[P['Verified By (Head, ICT Unit)']]), loggedAt: fmt_(r[P['Logged At']]),
    recordStatus: show_(r[P['Record Status']]) || 'Valid', hash: show_(r[P['Record Hash']])
  };
}

function checkPin_(pin) {
  const want = PropertiesService.getScriptProperties().getProperty('ICTU_PASSCODE');
  if (!want) throw new Error('ICTU passcode is not set. Run setup in Apps Script.');
  if (String(pin || '') !== want) throw new Error('Wrong ICTU passcode.');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);   // two people saving at once won't overwrite each other
  try { const out = fn(); SpreadsheetApp.flush(); return out; }
  finally { lock.releaseLock(); }
}

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" not found. Run setup in Apps Script.');
  return sh;
}

function lastRow_(sh) {
  const vals = sh.getRange(1, 1, sh.getMaxRows(), 1).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i][0] !== '') return i + 1;
  return 1;
}

// Last row with anything in the first `cols` columns (hand-pasted rows may have no ID yet).
function lastFilledRow_(sh, cols) {
  const vals = sh.getRange(1, 1, sh.getMaxRows(), cols).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (vals[i].some(v => v !== '')) return i + 1;
  return 1;
}

function findRow_(sh, key) {
  const n = lastRow_(sh);
  if (!key || n < 2) return 0;
  const vals = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === key) return i + 2;
  return 0;
}

// Text columns are plain text so serials like "0012" or times like "5:30 PM" stay as typed.
function formatInvRow_(sh, r) {
  ['Equipment ID', 'Property Tag No.', 'Serial No.', 'Computer Name / IP', 'Remarks', 'Last PM Ref No.']
    .forEach(k => sh.getRange(r, I[k] + 1).setNumberFormat('@'));
  ['Date Acquired', 'Warranty Until', 'Last PM', 'Next PM Due'].forEach(k => sh.getRange(r, I[k] + 1).setNumberFormat('mmm d, yyyy'));
  sh.getRange(r, I['Unit Cost'] + 1).setNumberFormat('#,##0.00');
  ['Added At', 'Updated At'].forEach(k => sh.getRange(r, I[k] + 1).setNumberFormat('mmm d, yyyy h:mm am/pm'));
}

function formatPmRow_(sh, r) {
  ['PM Ref No.', 'Time Start', 'Time End', 'Serial No.', 'Property Tag No.', 'Issue Identified', 'Action Taken', 'Remarks',
   'Computer Name / IP', 'Parts Replaced / Used'].forEach(k => sh.getRange(r, P[k] + 1).setNumberFormat('@'));
  ['Date', 'Next Check / PM Due'].forEach(k => sh.getRange(r, P[k] + 1).setNumberFormat('mmm d, yyyy'));
  sh.getRange(r, P['Logged At'] + 1).setNumberFormat('mmm d, yyyy h:mm am/pm');
}

function audit_(ref, action, by, details, device) {
  const sh = sheet_(AUDIT);
  const r = lastRow_(sh) + 1;
  sh.getRange(r, 1, 1, AUDIT_HEADERS.length)
    .setValues([[new Date(), ref || '', action, by || '', String(details || '').slice(0, 2000), String(device || '').slice(0, 200)]]);
  sh.getRange(r, 1).setNumberFormat('mmm d, yyyy h:mm:ss am/pm');
}

function protect_(sh) {
  const p = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)[0] || sh.protect();
  p.setDescription('Controlled record - edit through the ICT Inventory and PMS app only');
  const me = Session.getEffectiveUser();
  p.addEditor(me);
  p.removeEditors(p.getEditors().filter(u => u.getEmail() !== me.getEmail()));
  if (p.canDomainEdit()) p.setDomainEdit(false);
}

function sigFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SIG_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (err) {} }
  const f = DriveApp.createFolder(SIG_FOLDER);
  props.setProperty('SIG_FOLDER_ID', f.getId());
  return f;
}

function appUrl_() { try { return ScriptApp.getService().getUrl() || ''; } catch (err) { return ''; } }

// SHA-256 over the saved PM record, its checklist rows and the signature.
function hash_(row, chkRows, sig) {
  const keys = ['PM Ref No.', 'Date', 'Time Start', 'Time End', 'Office / Section', 'End User', 'Equipment ID',
    'Serial No.', 'Maintenance Type', 'Issue Identified', 'Action Taken', 'Overall Status', 'Parts Replaced / Used',
    'ICT Personnel', 'Acknowledged By (End User)', 'Verified By (Head, ICT Unit)', 'Logged At'];
  const text = keys.map(k => { const v = row[P[k]]; return v instanceof Date ? String(Math.round(v.getTime() / 1000)) : String(v); }).join('|') +
    '|' + chkRows.map(c => c.slice(1).join('~')).join('^') + '|' + sig;
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

// Trimmed, length-capped, and never starting with "=", "+", "-" or "@" (so it can't become a formula).
function clean_(s) { return String(s == null ? '' : s).trim().replace(/^[=+@]+\s*/, '').replace(/^-+(?=\s*[=+@(])/, '').slice(0, 1000); }

function toNum_(s) {
  const n = parseFloat(String(s == null ? '' : s).replace(/[^\d.]/g, ''));
  return isNaN(n) ? '' : n;
}

function toDate_(s) {
  if (s instanceof Date) return s;
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Utilities.parseDate(m[0] + ' 12:00', TZ, 'yyyy-MM-dd HH:mm') : null;   // noon Manila, so no day shift
}

function show_(v) { return v instanceof Date ? fmtDate_(v) : String(v == null ? '' : v); }
function fmt_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, 'MMM d, yyyy h:mm a') : String(d || ''); }
function fmtDate_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : String(d || ''); }
/** "DELA CRUZ, KIMBERLY ANN SANTOS" -> { surname: 'Dela Cruz', first: 'Kimberly Ann', middle: 'Santos', suffix: '' } */
function splitName_(text) {
  const SUFFIX = /^(JR|SR|II|III|IV|V)\.?$/i;
  const i = text.indexOf(',');
  const surname = text.slice(0, i).trim().split(/\s+/), rest = text.slice(i + 1).replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  let suffix = '';
  [surname, rest].forEach(words => {
    for (let j = words.length - 1; j >= 0; j--) if (SUFFIX.test(words[j]) && words.length > 1) suffix = words.splice(j, 1)[0];
  });
  const middle = rest.length > 1 ? rest.pop() : '';
  return { surname: properCase_(surname.join(' ')), first: properCase_(rest.join(' ')), middle: properCase_(middle),
    suffix: /^[js]r/i.test(suffix) ? suffix.charAt(0).toUpperCase() + 'r.' : suffix.toUpperCase() };
}

/** "OFFICE OF THE TRC CHIEF" -> "Office of the TRC Chief": small words stay small, known short forms stay capitals. */
function officeName_(t) {
  const SMALL = ['of', 'the', 'and', 'for', 'in', 'on', 'to'], KEEP = ['TRC', 'ICTU', 'IDTOMIS', 'IDADIN', 'DOH', 'HR', 'HRMO', 'IT', 'HIMS', 'BAC', 'ABTC', 'MMU', 'PACD'];
  return String(t || '').replace(/\s+/g, ' ').trim().split(' ').map((w, i) => w.split('/').map(p =>
    KEEP.indexOf(p.replace(/[()]/g, '').toUpperCase()) >= 0 ? p.toUpperCase()
      : (i > 0 && SMALL.indexOf(p.toLowerCase()) >= 0 ? p.toLowerCase() : (p === p.toUpperCase() || p === p.toLowerCase() ? properCase_(p) : p))).join('/')).join(' ');
}

function properCase_(t) {
  return String(t || '').toLowerCase().replace(/(^|[\s\-(\/])([a-zñ])/g, (m, p, ch) => p + ch.toUpperCase());
}

/** Compares names loosely: case, dots, spaces and accents do not matter. */
function nameKey_(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function idx_(h) { const o = {}; h.forEach((k, i) => o[k] = i); return o; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
