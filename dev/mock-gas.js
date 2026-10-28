/**
 * mock-gas.js: an in-memory stand-in for the Google services that apps-script/Code.gs uses
 * (Sheets, Drive, properties, lock, Utilities), so the backend can run on a PC with Node.js for testing.
 * Only what Code.gs calls is implemented.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const TZ_OFFSET = 8 * 3600e3;   // Asia/Manila, no daylight saving

function makeSheet(name) {
  const data = [], formats = {};
  const ensure = (r, c) => {
    while (data.length < r) data.push([]);
    for (let i = 0; i < data.length; i++) while (data[i].length < c) data[i].push('');
  };
  const sheet = {
    _data: data, _formats: formats,
    getName: () => name,
    getMaxRows: () => Math.max(1000, data.length),
    getRange: (r, c, nr = 1, nc = 1) => {
      if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error('Bad range ' + [r, c, nr, nc]);
      const range = {
        getValue: () => range.getValues()[0][0],
        getValues: () => { ensure(r + nr - 1, c + nc - 1); return data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)); },
        setValue: v => range.setValues([[v]]),
        setValues: vals => {
          if (vals.length !== nr || vals.some(row => row.length !== nc)) throw new Error('setValues size mismatch on ' + name);
          ensure(r + nr - 1, c + nc - 1);
          vals.forEach((row, i) => row.forEach((v, j) => {
            if (v === undefined || v === null) throw new Error('undefined value written to ' + name + ' r' + (r + i) + 'c' + (c + j));
            // Like Sheets: text that looks like a number or date is converted unless the cell is plain text (@).
            if (typeof v === 'string' && formats[(r + i) + ':' + (c + j)] !== '@') {
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v = new Date(v + 'T00:00:00+08:00');
              else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
            }
            data[r - 1 + i][c - 1 + j] = v;
          }));
          return range;
        },
        setNumberFormat: f => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) formats[(r + i) + ':' + (c + j)] = f; return range; },
        setFontWeight: () => range
      };
      return range;
    },
    setFrozenRows: () => {},
    getProtections: () => [],
    protect: () => { const p = { setDescription: () => p, addEditor: () => p, removeEditors: () => p, getEditors: () => [], canDomainEdit: () => false }; return p; }
  };
  return sheet;
}

function createGas() {
  const sheets = {}, order = [], props = {}, files = {};
  let seq = 0;
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
    getSheets: () => order.map(n => sheets[n]),
    setSpreadsheetTimeZone: () => {}
  };
  const pad = n => String(n).padStart(2, '0');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = (d, tz, f) => {
    const x = new Date(d.getTime() + TZ_OFFSET);
    const Y = x.getUTCFullYear(), M = x.getUTCMonth(), D = x.getUTCDate(), h = x.getUTCHours(), m = x.getUTCMinutes(), s = x.getUTCSeconds();
    const map = { 'yyyy': String(Y), 'yyyy-MM': Y + '-' + pad(M + 1), 'yyyy-MM-dd': Y + '-' + pad(M + 1) + '-' + pad(D),
      'yyyy-MM-dd HH:mm': Y + '-' + pad(M + 1) + '-' + pad(D) + ' ' + pad(h) + ':' + pad(m),
      'yyyy-MM-dd HHmmss': Y + '-' + pad(M + 1) + '-' + pad(D) + ' ' + pad(h) + pad(m) + pad(s),
      'MMM d, yyyy h:mm a': MON[M] + ' ' + D + ', ' + Y + ' ' + (h % 12 || 12) + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM') };
    if (!(f in map)) throw new Error('mock formatDate: unsupported pattern ' + f);
    return map[f];
  };
  const gas = {
    SpreadsheetApp: { getActive: () => ss, flush: () => {}, ProtectionType: { SHEET: 'SHEET' } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'salagfacility@gmail.com' }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/MOCK/exec' }) },
    Logger: { log: () => {} },
    HtmlService: { createHtmlOutputFromFile: () => { const o = { setTitle: () => o, addMetaTag: () => o, setXFrameOptionsMode: () => o }; return o; }, XFrameOptionsMode: { ALLOWALL: 1 } },
    ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    DriveApp: {
      createFolder: name => ({ getId: () => 'folder' + name, createFile: blob => {
        const id = 'file' + (++seq) + crypto.randomBytes(14).toString('hex');
        files[id] = blob;
        return { getUrl: () => 'https://drive.google.com/file/d/' + id + '/view', getId: () => id };
      } }),
      getFolderById: id => { throw new Error('not found'); },
      getFileById: id => { if (!files[id]) throw new Error('no file'); return { getBlob: () => files[id] }; }
    },
    Utilities: {
      formatDate,
      parseDate: (s, tz, f) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ_OFFSET); },
      newBlob: (bytes, type, name) => ({ bytes: Buffer.from(bytes), type, name, getBytes: function () { return [...this.bytes]; } }),
      base64Decode: s => [...Buffer.from(s, 'base64')],
      base64Encode: b => Buffer.from(b).toString('base64'),
      computeDigest: (alg, text) => [...crypto.createHash('sha256').update(text, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      getUuid: () => crypto.randomUUID(),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    _ss: ss, _props: props, _files: files
  };
  return gas;
}

// Loads Code.gs into a fresh mock and returns { gas, code } where code holds its top-level functions.
function loadBackend() {
  const gas = createGas();
  const ctx = vm.createContext(Object.assign({ console, Date }, gas));
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(src + '\n;this.__exports = { setup, verifyRecords, handle_, doGet, doPost, api, lists_ }; this.target_ = target_;', ctx, { filename: 'Code.gs' });
  return { gas, code: ctx.__exports, ctx };
}

// Fills a fresh backend with the seed rows (the RIS equipment and PM-2026-001), the same as the Sheet template.
function seed(be) {
  const { gas, code } = be;
  code.setup();
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));
  const ctx = be.ctx;
  const inv = gas._ss.getSheetByName('Inventory'), pm = gas._ss.getSheetByName('PM Log');
  const IH = vm.runInContext('INV_HEADERS', ctx), PH = vm.runInContext('PM_HEADERS', ctx);
  const d = x => x ? new Date(x + 'T12:00:00+08:00') : '';
  s.items.forEach((it, i) => {
    const row = IH.map(() => '');
    const set = (k, v) => { row[IH.indexOf(k)] = v == null ? '' : v; };
    set('Equipment ID', it.id); set('Equipment Type', it.type); set('Brand / Model', it.brand); set('Description / Specs', it.desc);
    set('Serial No.', it.serial); set('Office / Section', it.office); set('End User', it.endUser); set('Source Document (RIS / PAR / ICS)', it.source);
    set('OS Installed', it.os); set('PM Frequency', it.freq); set('Last PM', d(it.lastPm)); set('Last PM Ref No.', it.lastRef || ''); set('Condition', it.condition);
    set('Added At', new Date());
    inv.getRange(i + 2, 1, 1, IH.length).setNumberFormat('@');
    IH.forEach((k, j) => { if (row[j] instanceof Date) inv.getRange(i + 2, j + 1).setNumberFormat('mmm d, yyyy'); });
    inv.getRange(i + 2, 1, 1, IH.length).setValues([row]);
  });
  s.pms.forEach((p, i) => {
    const row = PH.map(() => '');
    const set = (k, v) => { row[PH.indexOf(k)] = v == null ? '' : v; };
    set('PM Ref No.', p.ref); set('Date', d(p.date)); set('Time Start', p.timeStart); set('Time End', p.timeEnd); set('Quarter', p.quarter);
    set('Office / Section', p.office); set('End User', p.endUser); set('Equipment Type', p.type); set('Brand / Model', p.brand);
    set('Under Warranty?', p.warranty); set('Maintenance Type', p.activity); set('Issue Identified', p.findings); set('Action Taken', p.action);
    set('Occurrence No. (same unit & type)', p.occurrence); set('Status', p.status); set('Remarks', p.remarks); set('Next Check / PM Due', 'N/A');
    set('ICT Personnel', p.personnel); set('End User Acknowledged?', p.ack); set('Equipment ID', p.equipmentId); set('PM Type', p.pmType);
    set('Frequency', p.freq); set('Overall Status', p.overall); set('Record Status', 'Valid');
    pm.getRange(i + 2, 1, 1, PH.length).setNumberFormat('@');
    pm.getRange(i + 2, 2).setNumberFormat('mmm d, yyyy');
    pm.getRange(i + 2, 1, 1, PH.length).setValues([row]);
  });
  const ms = gas._ss.insertSheet('Masterlist');
  ms.getRange(1, 1, s.masterlist.length, 3).setValues(s.masterlist);
  gas._props.ICTU_PASSCODE = '1234';
}

module.exports = { createGas, loadBackend, seed };
