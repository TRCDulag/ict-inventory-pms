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

// A made-up ISO folder in Drive: one procedure (.docx parts with a 3-column flow chart) and two other files.
const PNG1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const wp = t => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const wtc = (t, pic) => `<w:tc><w:tcPr/>${pic ? `<w:p><w:r><w:drawing><a:graphic><a:blip r:embed="${pic}"/></a:graphic></w:drawing></w:r></w:p>` : '<w:p/>'}${t ? wp(t) : ''}</w:tc>`;
const wrow = (who, pic, what) => `<w:tr>${wtc(who)}${wtc('', pic)}${wtc(what)}</w:tr>`;
const PROC_XML = `<?xml version="1.0"?><w:document ${W}><w:body>${wp('REVISION HISTORY')}<w:tbl>${wrow('REV. NO.', '', 'DESCRIPTION')}</w:tbl>` +
  wp('I. PURPOSE: To test the flow reader.') + wp('II. SCOPE: Sample only.') + wp('III. PROCEDURE / FLOW CHART:') +
  wp('A. REGISTERING ICT EQUIPMENT') + `<w:tbl>${wrow('', 'rId1', '')}${wrow('ICTU Personnel', 'rId2', 'Adds the unit to the masterlist &amp; gives the Equipment ID.')}${wrow('ICTU Personnel', 'rId2', 'If yes, go on. If no, stop.')}${wrow('', 'rId1', '')}</w:tbl>` +
  wp('B. JOB ORDER REQUEST (COH-IDN-F-01)') + `<w:tbl>${wrow('End User', 'rId2', 'Files a request.')}${wrow('ICTU Personnel', '', 'Works on it.')}</w:tbl>` +
  wp('IV. NOTES') + wp('1. A sample note.') + `</w:body></w:document>`;
const HEAD_XML = `<w:hdr ${W}><w:tbl><w:tr>${wtc('Document Title:')}${wtc('SAMPLE PROCEDURE FOR TESTS')}</w:tr></w:tbl></w:hdr>`;
const RELS = '<Relationships><Relationship Id="rId1" Type="image" Target="media/image1.png"/><Relationship Id="rId2" Type="image" Target="media/image2.png"/></Relationships>';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ISO_TREE = { id: 'ISOFOLDER0123456789abc', name: 'ISO (test)', files: [{ id: 'README000000000001', name: 'Please read first.md', mime: 'text/markdown' }],
  folders: [{ name: 'ICTU Procedures', files: [{ id: 'PROC00000000000001', name: 'COH-IDN-P-01 Rev 01 Sample Procedure.docx', mime: DOCX,
      parts: { 'word/document.xml': PROC_XML, 'word/header2.xml': HEAD_XML, 'word/_rels/document.xml.rels': RELS, 'word/media/image1.png': PNG1, 'word/media/image2.png': PNG1 } }], folders: [] },
    { name: 'ICTU Forms DRF', files: [{ id: 'PREVIEWOLD00000001', name: 'All DRFs (preview).pdf', mime: 'application/pdf', modified: '2026-11-04T09:00:00+08:00' },
      { id: 'PREVIEWNEW00000001', name: 'All DRFs (preview).pdf', mime: 'application/pdf', modified: '2026-11-05T10:00:00+08:00' },
      { id: 'NOTE00000000000001', name: 'Please read first.md', mime: 'text/markdown' }],
      folders: [{ name: 'DRFs', files: [{ id: 'DRF000000000000001', name: 'DRF COH-IDN-F-01 ICTU Job Order Request Form.pdf', mime: 'application/pdf' }].concat(['02', '03'].map(n => ({ id: 'DRFF' + n + '0000000000001', name: 'DRF COH-IDN-F-' + n + '.docx', mime: DOCX }))), folders: [] },
        { name: 'Form drafts', files: ['10', '11', '12'].map(n => ({ id: 'FDR' + n + '00000000000001', name: 'COH-IDN-F-' + n + ' draft.docx', mime: DOCX })), folders: [] }] },
    { name: 'ICTU Revisions 2025-2026', files: [{ id: 'NOTE00000000000002', name: 'Please check before printing.md', mime: 'text/markdown' }], folders: ['Rev 02 (July 2025)', 'Rev 03 (January 2026)', 'Rev 04 (July 2026)'].map((n, i) => ({ name: n, files: [{ id: 'REVF' + i + '00000000000001', name: 'COH-QMS-F-06 Context ICTU Rev 0' + (i + 2) + '.docx', mime: DOCX }, { id: 'REVG' + i + '00000000000001', name: 'COH-QMS-F-07 ROA ICTU Rev 0' + (i + 2) + '.docx', mime: DOCX }], folders: [] })) },
    { name: 'CAR', files: [{ id: 'CAR000000000000001', name: 'COH-QMS-F-12 CAR (answered).pdf', mime: 'application/pdf' }], folders: [] }] };
function isoFile(id, t) { t = t || ISO_TREE; return t.files.find(f => f.id === id) || t.folders.map(x => isoFile(id, x)).find(Boolean) || null; }
function iter(list) { let i = 0; return { hasNext: () => i < list.length, next: () => list[i++] }; }
function isoFolderObj(t) {
  return { getId: () => t.id || 'sub' + t.name, getName: () => t.name, getUrl: () => 'https://drive.google.com/drive/folders/' + (t.id || 'sub'),
    getFiles: () => iter(t.files.map(f => ({ getId: () => f.id, getName: () => f.name, getMimeType: () => f.mime, getSize: () => 1234,
      getLastUpdated: () => new Date(f.modified || '2026-11-05T09:00:00+08:00'), getDateCreated: () => new Date(f.modified || '2026-11-05T09:00:00+08:00'), getUrl: () => 'https://drive.google.com/file/d/' + f.id + '/view' }))),
    getFolders: () => iter(t.folders.map(isoFolderObj)) };
}

function createGas() {
  const sheets = {}, order = [], props = {}, files = {}, cache = {}, triggers = [], copies = [], fetches = [], mails = [];
  let seq = 0;
  const ss = {
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => { sheets[n] = makeSheet(n); order.push(n); return sheets[n]; },
    getSheets: () => order.map(n => sheets[n]),
    getId: () => 'SHEETID', getName: () => 'ICT Inventory and PMS Register (ICTU)',
    setSpreadsheetTimeZone: () => {}
  };
  const pad = n => String(n).padStart(2, '0');
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = (d, tz, f) => {
    const x = new Date(d.getTime() + TZ_OFFSET);
    const Y = x.getUTCFullYear(), M = x.getUTCMonth(), D = x.getUTCDate(), h = x.getUTCHours(), m = x.getUTCMinutes(), s = x.getUTCSeconds();
    const map = { 'yyyy': String(Y), 'yyyy-MM': Y + '-' + pad(M + 1), 'yyyy-MM-dd': Y + '-' + pad(M + 1) + '-' + pad(D),
      'yyyy-MM-dd HH:mm': Y + '-' + pad(M + 1) + '-' + pad(D) + ' ' + pad(h) + ':' + pad(m),
      'yyyy-MM-dd HHmm': Y + '-' + pad(M + 1) + '-' + pad(D) + ' ' + pad(h) + pad(m),
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
    ScriptApp: { getOAuthToken: () => 'mock-token', getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/MOCK/exec' }),
      getProjectTriggers: () => triggers.map(h => ({ getHandlerFunction: () => h })),
      newTrigger: h => { const t = { timeBased: () => t, onMonthDay: () => t, atHour: () => t, create: () => { triggers.push(h); return t; } }; return t; } },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    Logger: { log: () => {} },
    // Stands in for Gemini: answers a sticker photo with the fields of the sample sticker.
    UrlFetchApp: { fetch: (url, o) => { fetches.push({ url, body: o.payload ? JSON.parse(o.payload) : null });
      if (/\/export\?format=xlsx/.test(url)) return { getResponseCode: () => 200, getBlob: () => { const b = { name: '', bytes: Buffer.from('PK fake xlsx'),
        setName(n) { b.name = n; return b; }, getBytes() { return [...b.bytes]; } }; return b; } };
      const text = JSON.stringify({ type: 'Laptop', brand: 'Lenovo', propertyNo: 'SEICT-HV-25-11-102', icsNo: '2025-11-212', parNo: '', accountable: 'JA Elona', cost: 'Php 45,500.00', eulYears: 5, serial: '', dateAcquired: '' });
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) }; } },
    CalendarApp: (() => {
      let n = 0;
      const ev = (t, a, b, all, o) => { const tags = {}; return { id: 'EV' + (++n), getId() { return this.id; }, getTitle: () => t, isAllDayEvent: () => !!all, getStartTime: () => new Date(a), getEndTime: () => new Date(b),
        getLocation: () => (o && o.location) || '', getDescription: () => (o && o.description) || '', setTag: (k, v) => { tags[k] = v; }, getTag: k => (k in tags ? tags[k] : null) }; };
      const cal = (name, list) => ({ getName: () => name, _list: list,
        getEvents: (a, b) => list.filter(e => e.getStartTime() >= a && e.getStartTime() < b).sort((x, y) => x.getStartTime() - y.getStartTime()),
        createEvent(t, a, b, o) { const e = ev(t, a, b, false, o); e.deleteEvent = () => list.splice(list.indexOf(e), 1); list.push(e); return e; },
        createAllDayEvent(t, a, b, o) { const e = ev(t, a, b, true, o); e.deleteEvent = () => list.splice(list.indexOf(e), 1); list.push(e); return e; },
        getEventById: id => list.find(e => e.id === id) || null });
      const own = cal('salagfacility@gmail.com', [ev('Flag ceremony', '2026-11-09T07:30:00+08:00', '2026-11-09T08:30:00+08:00'), ev('ISO internal audit', '2026-11-12T00:00:00+08:00', '2026-11-13T00:00:00+08:00', true), ev('ICTU planning', '2026-12-02T13:00:00+08:00', '2026-12-02T15:00:00+08:00')]);
      const jed = cal('Jed (test)', [ev('ICTU planning', '2026-12-02T13:00:00+08:00', '2026-12-02T15:00:00+08:00')]);
      const hol = cal('Holidays in the Philippines', [ev("All Saints' Day", '2026-11-01T00:00:00+08:00', '2026-11-02T00:00:00+08:00', true), ev('Bonifacio Day', '2026-11-30T00:00:00+08:00', '2026-12-01T00:00:00+08:00', true), ev('Christmas Day', '2026-12-25T00:00:00+08:00', '2026-12-26T00:00:00+08:00', true)]);
      let subscribed = false;
      return { getDefaultCalendar: () => own,
        getCalendarById: id => /^jed@example\.com$/.test(id) ? jed : id === 'en.philippines#holiday@group.v.calendar.google.com' && subscribed ? hol : null,
        subscribeToCalendar: id => { if (id !== 'en.philippines#holiday@group.v.calendar.google.com') throw new Error('no such calendar'); subscribed = true; return hol; } };
    })(),
    MailApp: { getRemainingDailyQuota: () => 100 - mails.length, sendEmail: o => { mails.push(o); } },
    HtmlService: { createHtmlOutputFromFile: () => { const o = { setTitle: () => o, setFaviconUrl: () => o, addMetaTag: () => o, setXFrameOptionsMode: () => o }; return o; }, XFrameOptionsMode: { ALLOWALL: 1 } },
    ContentService: { createTextOutput: t => ({ text: t, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    DriveApp: {
      createFolder: name => ({ getId: () => 'folder' + name, createFile: blob => {
        const id = 'file' + (++seq) + crypto.randomBytes(14).toString('hex');
        files[id] = blob;
        return { getUrl: () => 'https://drive.google.com/file/d/' + id + '/view', getId: () => id };
      } }),
      getFolderById: id => { if (id === ISO_TREE.id) return isoFolderObj(ISO_TREE); throw new Error('not found'); },
      getFileById: id => {
        if (id === 'SHEETID') return { makeCopy: (name, folder) => { copies.push(name); return { getUrl: () => 'https://docs.google.com/spreadsheets/d/copy' + copies.length, getId: () => 'copy' + copies.length }; } };
        const iso = isoFile(id); if (iso) return { getBlob: () => ({ _parts: iso.parts, setContentType() { return this; } }) };
        if (!files[id]) throw new Error('no file'); return { getBlob: () => files[id] };
      }
    },
    Utilities: {
      formatDate,
      parseDate: (s, tz, f) => { const m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/); return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - TZ_OFFSET); },
      newBlob: (bytes, type, name) => ({ bytes: Buffer.from(bytes), type, name, getBytes: function () { return [...this.bytes]; } }),
      base64Decode: s => [...Buffer.from(s, 'base64')],
      base64Encode: b => Buffer.from(b).toString('base64'),
      computeDigest: (alg, text) => [...crypto.createHash('sha256').update(text, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
      getUuid: () => crypto.randomUUID(),
      unzip: blob => { if (!blob._parts) throw new Error('not a zip'); return Object.keys(blob._parts).map(n => ({ getName: () => n,
        getDataAsString: () => Buffer.from(blob._parts[n]).toString('utf8'), getBytes: () => [...Buffer.from(blob._parts[n])] })); },
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }
    },
    _ss: ss, _props: props, _files: files, _cache: cache, _triggers: triggers, _copies: copies, _fetches: fetches, _mails: mails
  };
  return gas;
}

// Loads Code.gs into a fresh mock and returns { gas, code } where code holds its top-level functions.
function loadBackend() {
  const gas = createGas();
  const ctx = vm.createContext(Object.assign({ console, Date }, gas));
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(src + '\n;this.__exports = { setup, verifyRecords, handle_, doGet, doPost, api, lists_, monthlyBackup }; this.target_ = target_;', ctx, { filename: 'Code.gs' });
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
  delete gas._props.PM_RULES;   // the seed rows are older than 1.7.0: the first load applies the PM rules, like an upgrade
}

module.exports = { createGas, loadBackend, seed };
