# ICT Inventory and PMS (ICTU)

One app for the ICT Unit of DOH TRC Dulag that keeps the ICT equipment masterlist, runs the preventive maintenance (PMS) of every unit, and logs the ICTU job orders. Records stay in a Google Sheet for audit.

It does these things:

1. **Inventory masterlist.** Every unit with its property tag, serial no., office, end user, source document (RIS, PAR or ICS), warranty and condition. Units that leave service are marked Disposed and kept on record.
2. **PMS schedule.** Each unit has a PM frequency (Quarterly, Semi-Annual, Annual, or checked together with its PC). The app works out the next PM from the last one and shows what is overdue, due this month and coming up. The year view prints as an A4 schedule.
3. **PM checklist and form.** At the unit, ICTU fills in Form COH-IDN-F-02 Rev. 01 on a phone, tablet or PC. Only the checklist items that fit the equipment type are shown. The end user can sign on the screen. Saving gives the next PM Ref. No. (PM-2026-002 and up, continuing the old PM Log), updates the masterlist and moves the schedule. The filled form prints on one A4 page.
4. **Job orders.** Form COH-IDN-F-01 Rev. 01 under ADM-HIMS-P-03. Staff file a request on the public request page (no passcode) and get a JO No. (ICTU-YYYY-NNNN) right away. ICTU logs walk-in and phone requests, sets the priority, works the job order through Part II and Part III, and prints the filled form. Each priority has its target time (P1 4 working hours, P2 1 working day, P3 3, P4 7), so the app flags job orders past their target and records whether each closed one met it.
5. **QR property labels.** Each unit gets a printable label (24 on an A4 sheet) with a QR code and its Equipment ID. Scanning it with any phone camera opens a status page for that unit (no passcode, no names): its condition, last and next PM, and open job orders, with a button to report a problem. ICTU can open the full record from there with the passcode, or use *Scan code* in the app.
6. **Reports.** The quarterly ICTU/IDADIN Preventive Maintenance Report, the Monthly ICTU Job Order Report (step 12 of ADM-HIMS-P-03: JOs by type and priority, percent within target, open and on-hold, repeat problems, equipment for replacement, CSM results), the equipment service and maintenance history, the masterlist, the schedule, blank COH-IDN-F-01 and COH-IDN-F-02, a request QR poster, and Excel (CSV) downloads.

Everything except the request page and the QR status page needs the ICTU passcode. Equipment and staff data live only in the Google Sheet, never in this repo. A data privacy notice (RA 10173) is shown at the bottom of every page.

**Links.** The app opens from the Apps Script /exec link, or from GitHub Pages at https://trcdulag.github.io/ict-inventory-pms/ (the page there calls the same /exec link, set as `DEFAULT_URL` in the page). Both use the same Sheet and passcode.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Paste it into Apps Script as the HTML file `Index`. |
| `apps-script/Code.gs` | The Google Sheet backend. It also serves the page at the app link. |
| `Register/ICT Inventory and PMS Register (ICTU).xlsx` | An empty Sheet template, with the tabs Inventory, PM Log, Checklist Results, JO Log, Audit Trail, Lists and About. The filled copy (the RIS units and PM-2026-001) is kept outside this repo, because the repo is public. |
| `src/index.src.html` | The page source without the logos (`npm run build` makes `index.html`). |
| `dev/vendor/qrcode.min.js` | QR Code Generator by Kazuhiko Arase (MIT license), built into the page for the labels. |
| `dev/` | Tests, the local test server and the template builder. |

## Setup (one time, about 10 minutes, signed in as salagfacility@gmail.com)

1. **Make the Sheet.** In Google Drive, upload `ICT Inventory and PMS Register (ICTU).xlsx`, open it and choose *File > Save as Google Sheets*. Use the new Google Sheet, not the xlsx.
2. **Add the script.** In the Sheet, go to *Extensions > Apps Script*.
   - In `Code.gs`, delete what is there and paste all of `apps-script/Code.gs`.
   - Click **+ > HTML** and name it `Index` (no `.html`). Delete what is there and paste all of `index.html`. Click Save.
   - In *Project Settings (gear)*, set the time zone to *(GMT+08:00) Manila* if it is not already.
3. **Run setup.** Pick `setup` in the function list at the top and click **Run**, then allow the permissions (Sheets and Drive). This step protects every tab so only the owner can edit by hand, sets the Manila time zone, makes the Drive folder *ICT PMS Signatures* and sets the ICTU passcode to **1234**.
4. **Change the passcode.** Go to *Project Settings (gear) > Script properties*, edit `ICTU_PASSCODE`, and give the new one only to ICTU staff.
5. **Deploy.** Go to *Deploy > New deployment > Web app*. Set *Execute as: Me* and *Who has access: Anyone*, then click Deploy and copy the URL that ends in `/exec`. That is the app link. Open it on the ICTU phones, tablets and PCs and add it to the home screen.

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

## Day to day

- **Adding equipment.** Inventory tab, *Add equipment to the masterlist* at the bottom of the list. Or paste many rows straight into the Inventory tab of the Sheet with the Equipment ID left blank. The next time the app opens it gives each row an ID and notes it in the Audit Trail.
- **Doing a PM.** Home or PMS Schedule, *Start PM* on the unit (or the Do PM tab and search). Fill in sections A to E, then *Save PM record*. Print the filled form for the end user and the Head of the ICT Unit to sign, then file it with the ICT Unit.
- **A wrong PM entry.** PM Records, open it, *Void this record* and give the reason. It stays in the Sheet marked Voided, and the unit goes back to its previous PM date.
- **Lists.** Offices, staff names and positions, equipment types with their default PM frequency, work types and conditions are in the Lists tab of the Sheet. Edit them there (you are the owner) and choose *Refresh data* in the ICTU menu at the top right of the app.
- **QR labels.** Inventory tab, filter the list (for example by section), then *Print QR labels*. Print on A4 sticker paper, or on plain paper and tape it on. One label is also in each unit's details.

## Record control (ISO 9001:2015, clause 7.5)

- Every tab is protected. The app writes through the script, and only with the ICTU passcode.
- Nothing is deleted. PM records are voided with a reason; equipment is marked Disposed.
- Each PM record has a SHA-256 **record hash** of its details, checklist answers and signature. Run `verifyRecords` in Apps Script to check that no saved record was edited by hand. The result goes to the Audit Trail.
- Job orders are never deleted. A wrong one is set to *Cancelled*, and every change is kept in its Action History and in the Audit Trail.
- The Audit Trail tab lists every added or edited unit (with the old and new values), every PM saved or voided, setup and verify runs, with the server time and the device.

The effectivity dates of COH-IDN-F-02 Rev. 01 and COH-IDN-F-01 Rev. 01 are blank on the forms, so they print blank. Put them in `FORM.effectivity` and `JO_FORM.effectivity` at the top of `Code.gs` once the QMS document controller gives them.

## For developers

```
npm run build      # src/index.src.html + logos -> index.html
npm test           # backend rules on a mock of Google services
npm run dev        # local server on http://localhost:8787 with made-up test data (Sheet link http://localhost:8787/api, passcode 1234)
npm run test:e2e   # browser test with Playwright
node dev/headers.js > /tmp/heads.json && python3 dev/make-register.py /tmp/heads.json   # rebuild the Sheet template
```
