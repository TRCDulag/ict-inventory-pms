# ICT Inventory and PMS (ICTU)

One app for the ICT Unit of DOH TRC Dulag that keeps the ICT equipment masterlist, runs the preventive maintenance (PMS) of every unit, and logs the ICTU job orders. Records stay in a Google Sheet for audit.

It does these things:

1. **Inventory masterlist.** Every unit with its property tag, serial no., office, end user, source document (RIS, PAR or ICS), warranty and condition. Units that leave service are marked Disposed and kept on record.
2. **PMS schedule.** Each unit has a PM frequency (Quarterly, Semi-Annual, Annual, or checked together with its PC). The app works out the next PM from the last one and shows what is overdue, due this month and coming up. The year view prints as an A4 schedule.
3. **PM checklist and form.** At the unit, ICTU fills in Form COH-IDN-F-02 Rev. 01 on a phone, tablet or PC. Only the checklist items that fit the equipment type are shown. The end user can sign on the screen. Saving gives the next PM Ref. No. (PM-2026-002 and up, continuing the old PM Log), updates the masterlist and moves the schedule. The filled form prints on one A4 page.
4. **Job orders.** Form COH-IDN-F-01 Rev. 01 under ADM-HIMS-P-03. Staff file a request on the public request page (no account needed) and get a JO No. (ICTU-YYYY-NNNN) right away. ICTU logs walk-in and phone requests, sets the priority, works the job order through Part II and Part III, and prints the filled form. Each priority has its target time (P1 4 working hours, P2 1 working day, P3 3, P4 7), so the app flags job orders past their target and records whether each closed one met it.
5. **QR property labels.** Each unit gets a printable label (24 on an A4 sheet) with a QR code and its Equipment ID. Scanning it with any phone camera opens a status page for that unit (no account needed, no names): its condition, last and next PM, and open job orders, with a button to report a problem. ICTU staff can open the full record from there after signing in, or use *Scan code* in the app.
6. **Property and lifecycle.** Transfers and turnovers (new section, end user or accountable officer, with the PAR / ICS / PTR no.) update the masterlist and print a transfer slip. A replacement plan by age uses the date acquired and the useful life of each type. The Technical Inspection Report (TIR) prints from the job order. Spare parts and consumables have a stock list, receipts and issues, stock cards and low-stock flags. Each unit shows its cost so far (unit cost, parts issued, outside repairs), flagged when repairs reach half of its cost.
7. **Service desk.** A dashboard with charts, an incident and data breach log with the NPC 72-hour mark, and a network and IP inventory. After a job order is closed, the requestor rates the service on their phone from the link or QR on their form (CSM).
8. **Reports.** The quarterly ICTU/IDADIN Preventive Maintenance Report, the Monthly ICTU Job Order Report (step 12 of ADM-HIMS-P-03: JOs by type and priority, percent within target, open and on-hold, repeat problems, equipment for replacement, CSM results), the equipment service and maintenance history, the masterlist, the schedule, blank COH-IDN-F-01 and COH-IDN-F-02, a request QR poster, and Excel (CSV) downloads.

Only ICT Unit staff have accounts, each with their own username and password and a role: **Head** (everything, including accounts, voiding and backups), **Technician** (records PMs, job orders, transfers, stock, incidents, network) or **Viewer** (look and print only). Other offices use the request page, and ask for reports through a "Data request" job order. The request page, the QR status page and the requestor's tracking link need no account. Equipment and staff data live only in the Google Sheet, never in this repo. A data privacy notice (RA 10173) is shown at the bottom of every page; on the sign-in card it is a link that opens it.

**Links.** The app opens from the Apps Script /exec link, or from GitHub Pages at https://trcdulag.github.io/ict-inventory-pms/ (the page there calls the same /exec link, set as `DEFAULT_URL` in the page). Both use the same Sheet and accounts.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Paste it into Apps Script as the HTML file `Index`. |
| `apps-script/Code.gs` | The Google Sheet backend. It also serves the page at the app link. |
| `Register/ICT Inventory and PMS Register (ICTU).xlsx` | An empty Sheet template, with the tabs Inventory, PM Log, Checklist Results, JO Log, Users, Transfers, Stock Items, Stock Movements, Incidents, Network, Audit Trail, Lists and About. The filled copy (the RIS units and PM-2026-001) is kept outside this repo, because the repo is public. |
| `src/index.src.html` | The page source without the logos (`npm run build` makes `index.html`). |
| `icons/`, `manifest.json` | The app icon (server stack with the TRC Dulag seal). The page and the /exec link load it from GitHub Pages, so it also shows when the app is added to a phone's home screen. |
| `dev/vendor/qrcode.min.js` | QR Code Generator by Kazuhiko Arase (MIT license), built into the page for the labels. |
| `dev/` | Tests, the local test server and the template builder. |

## Setup (one time, about 10 minutes, signed in as salagfacility@gmail.com)

1. **Make the Sheet.** In Google Drive, upload `ICT Inventory and PMS Register (ICTU).xlsx`, open it and choose *File > Save as Google Sheets*. Use the new Google Sheet, not the xlsx.
2. **Add the script.** In the Sheet, go to *Extensions > Apps Script*.
   - In `Code.gs`, delete what is there and paste all of `apps-script/Code.gs`.
   - Click **+ > HTML** and name it `Index` (no `.html`). Delete what is there and paste all of `index.html`. Click Save.
   - In *Project Settings (gear)*, set the time zone to *(GMT+08:00) Manila* if it is not already.
3. **Run setup.** Pick `setup` in the function list at the top and click **Run**, then allow the permissions (Sheets, Drive, and running on a schedule). This step adds any missing tab, protects every tab so only the owner can edit by hand, sets the Manila time zone, makes the Drive folders *ICT PMS Signatures* and *ICT Inventory and PMS Backups*, turns on the monthly backup (1st of the month, about 6 AM) and sets the setup passcode `ICTU_PASSCODE` to **1234** if there is none.
4. **First account.** Open the app. Since there are no accounts yet, it asks for the setup passcode and makes the Head of ICTU's account. Then, under *Accounts*, add each ICTU staff member with a role. Each one gets a temporary password, shown once, and chooses their own the first time they sign in. The passcode is not used again after the first account.
5. **Deploy.** Go to *Deploy > New deployment > Web app*. Set *Execute as: Me* and *Who has access: Anyone*, then click Deploy and copy the URL that ends in `/exec`. That is the app link. Open it on the ICTU phones, tablets and PCs and add it to the home screen.

**Updating from 1.2 to 1.3:** paste the new `Code.gs` and `Index`, run `setup` once (it adds the new tabs and columns, and asks for the new permission for the monthly backup), then deploy a New version. The old passcode no longer opens the app; it only makes the first Head account.

**After changing the script or the page:** *Deploy > Manage deployments > pencil > Version: New version > Deploy*. The link stays the same. The GitHub Pages copy updates by itself when `index.html` changes on the `main` branch.

**GitHub Pages (one time):** the repo must be public. In the repo, *Settings > Pages*, set Source to *Deploy from a branch*, Branch *main*, folder */ (root)*, and Save.

## Employee lists

The end user, accountable officer and "acknowledged by" fields pick from the employee list. It comes from two tabs in the Sheet:

- **Masterlist**: paste the HR "Masterlist of Employees - Permanent" into a tab named exactly `Masterlist`, as it is (section headings in column A, "Position - SG-n" in column B, "SURNAME, FIRST MIDDLE" in column C). Each section heading becomes an office. Replace the rows whenever HR sends a new masterlist.
- **Added Employees**: staff not on the masterlist (job order, contract of service, new hires) added with the *Add employee* button.

Picking an employee fills in the section / unit where that employee is assigned (ICTU can still change it). When the name or section is not on the list, the last line of the list adds it: *Add a new employee* saves to the Added Employees tab, and *Add a new section* saves to the Lists tab. Both are logged in the Audit Trail. The masterlist stays in the Sheet only; it is never put in this repo.

## Job orders

- **Staff request page:** https://trcdulag.github.io/ict-inventory-pms/#request. Print the request QR poster (Job Orders tab) for the ICTU door and the bulletin boards. A request filed there lands in the JO Log tab as *Received*, and the requestor can print the filled form to sign.
- **Continuing the old JO numbers.** Either paste the rows of the old JO Log into the JO Log tab (same column order, first 33 columns), or add a Script property `JO_LAST_2026` with the last JO number used this year (for example `37`, so the next is ICTU-2026-0038).
- **The old online request form** still works if its `SHEET_URL` is changed to this script's /exec link. Its requests land in the same JO Log.
- **Beyond economical repair.** Setting that status on a job order linked to a unit offers to mark the unit Unserviceable, which takes it off the PMS schedule.

## Accounts, sign-in and backups

- Sign-ins last 6 hours from the last use. Five wrong passwords lock that username for 15 minutes.
- The Head resets a forgotten password under *Accounts* (a new temporary password is shown once) and can disable an account at once. There is always at least one active Head.
- Passwords are kept only as salted hashes in the Users tab. The Audit Trail names the signed-in person for every change, and logs sign-ins and failed tries.
- Backups: a dated copy of the whole Sheet goes to the Drive folder *ICT Inventory and PMS Backups* every month. The Head can also choose *Back up now*. To restore, open the copy and use it as the Sheet (copy its tabs back, or bind the script to it).

## Day to day

- **Adding equipment.** Inventory tab, *Add equipment to the masterlist* at the bottom of the list. Or paste many rows straight into the Inventory tab of the Sheet with the Equipment ID left blank. The next time the app opens it gives each row an ID and notes it in the Audit Trail.
- **Importing from Excel (Head only).** Inventory tab, *Import from Excel*, then pick an .xlsx or .csv whose first row has the same column names as the Inventory tab (and, if any, a PM Log tab with the PM Log column names), such as the ICT Inventory and PMS Register. Units already in the masterlist (same Equipment ID or serial no.) and PM records already in the log are skipped, so importing the same file twice does no harm.
- **Doing a PM.** Home or PMS Schedule, *Start PM* on the unit (or the Do PM tab and search). Fill in sections A to E, then *Save PM record*. Print the filled form for the end user and the Head of the ICT Unit to sign, then file it with the ICT Unit.
- **A wrong PM entry.** PM Records, open it, *Void this record* and give the reason. It stays in the Sheet marked Voided, and the unit goes back to its previous PM date.
- **Lists.** Offices, staff names and positions, equipment types with their default PM frequency, work types and conditions are in the Lists tab of the Sheet. Edit them there (you are the owner) and choose *Refresh data* in the ICTU menu at the top right of the app.
- **QR labels.** Inventory tab, filter the list (for example by section), then *Print QR labels*. Print on A4 sticker paper, or on plain paper and tape it on. One label is also in each unit's details.

## Record control (ISO 9001:2015, clause 7.5)

- Every tab is protected. The app writes through the script, and only for a signed-in ICTU account whose role allows the change.
- Nothing is deleted. PM records are voided with a reason; equipment is marked Disposed.
- Each PM record has a SHA-256 **record hash** of its details, checklist answers and signature. Run `verifyRecords` in Apps Script to check that no saved record was edited by hand. The result goes to the Audit Trail.
- Job orders are never deleted. A wrong one is set to *Cancelled*, and every change is kept in its Action History and in the Audit Trail.
- The Audit Trail tab lists every added or edited unit (with the old and new values), every PM saved or voided, setup and verify runs, with the server time and the device.

The effectivity dates of COH-IDN-F-02 Rev. 01 and COH-IDN-F-01 Rev. 01 are blank on the forms, so they print blank. Put them in `FORM.effectivity` and `JO_FORM.effectivity` at the top of `Code.gs` once the QMS document controller gives them.

## For developers

```
npm run build      # src/index.src.html + logos -> index.html
npm test           # backend rules on a mock of Google services
npm run dev        # local server on http://localhost:8787 with made-up test data (Sheet link http://localhost:8787/api; the first account is made with setup passcode 1234)
npm run test:e2e   # browser test with Playwright
node dev/headers.js > /tmp/heads.json && python3 dev/make-register.py /tmp/heads.json   # rebuild the Sheet template
```
