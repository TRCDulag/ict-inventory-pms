// Prints the tab headers and default lists of Code.gs as JSON (used by dev/make-register.py).
const vm = require('vm');
const { loadBackend } = require('./mock-gas');
const be = loadBackend(), g = k => vm.runInContext(k, be.ctx);
console.log(JSON.stringify({ INV: g('INV_HEADERS'), PM: g('PM_HEADERS'), CHK: g('CHK_HEADERS'), AUD: g('AUDIT_HEADERS'), L: g('DEFAULT_LISTS'), FORM: g('FORM'), JOF: g('JO_FORM'), JO: g('JO_HEADERS'), V: g('VERSION'), USERS: g('USER_HEADERS'), TR: g('TRANSFER_HEADERS'), STOCK: g('STOCK_HEADERS'), MOVES: g('MOVE_HEADERS'), INC: g('INCIDENT_HEADERS'), NET: g('NET_HEADERS'), LH: g('LIST_HEADERS') }));
