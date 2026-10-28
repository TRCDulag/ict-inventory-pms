/**
 * ICT Inventory and PMS (ICTU) - backend for the "Index" page.
 * Keeps the ICT equipment masterlist, the PMS schedule and the PM records
 * (Form COH-IDN-F-02, ICT Equipment Preventive Maintenance Checklist, Rev. 01).
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
 * ADDING EQUIPMENT IN BULK: paste rows straight into the Inventory tab (leave the
 * Equipment ID blank). The next time the app loads, each new row gets its ID and
 * its Next PM Due, and the Audit Trail notes it.
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
const VERSION = '1.0.0';

const FORM = { code: 'COH-IDN-F-02', rev: '01', effectivity: '', title: 'ICT Equipment Preventive Maintenance Checklist' };

const INV = 'Inventory', PM = 'PM Log', CHK = 'Checklist Results', AUDIT = 'Audit Trail', LISTS = 'Lists';

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

const I = idx_(INV_HEADERS), P = idx_(PM_HEADERS);

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
    checkPin_(req.pin);   // everything else is for ICTU only
    switch (req.action) {
      case 'checkPin':      return { ok: true };
      case 'load':          return load_();
      case 'saveEquipment': return saveEquipment_(req);
      case 'savePM':        return savePM_(req);
      case 'getPM':         return getPM_(req.ref);
      case 'voidPM':        return voidPM_(req);
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
  return { ok: true, version: VERSION, form: FORM, lists: lists_(), inventory: inv, pms: pms,
           today: fmtDate_(new Date()), appUrl: appUrl_() };
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

// ---------- one-time setup and checks (run from the editor) ----------

function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  [[INV, INV_HEADERS], [PM, PM_HEADERS], [CHK, CHK_HEADERS], [AUDIT, AUDIT_HEADERS]].forEach(([name, h]) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getRange(1, 1).getValue() !== h[0]) {
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
function idx_(h) { const o = {}; h.forEach((k, i) => o[k] = i); return o; }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
