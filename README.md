# ICT Inventory and PMS (ICTU)

One app for the ICT Unit of DOH TRC Dulag that keeps the ICT equipment masterlist and runs the preventive maintenance (PMS) of every unit. Records stay in a Google Sheet for audit.

It does four things:

1. **Inventory masterlist.** Every unit with its property tag, serial no., office, end user, source document (RIS, PAR or ICS), warranty and condition. Units that leave service are marked Disposed and kept on record.
2. **PMS schedule.** Each unit has a PM frequency (Quarterly, Semi-Annual, Annual, or checked together with its PC). The app works out the next PM from the last one and shows what is overdue, due this month and coming up. The year view prints as an A4 schedule.
3. **PM checklist and form.** At the unit, ICTU fills in Form COH-IDN-F-02 Rev. 01 on a phone, tablet or PC. Only the checklist items that fit the equipment type are shown. The end user can sign on the screen. Saving gives the next PM Ref. No. (PM-2026-002 and up, continuing the old PM Log), updates the masterlist and moves the schedule. The filled form prints on one A4 page.
4. **Reports.** The quarterly ICTU/IDADIN Preventive Maintenance Report, the masterlist, the schedule, a blank COH-IDN-F-02, and Excel (CSV) downloads.

Everything needs the ICTU passcode. Equipment data lives only in the Google Sheet, never in this repo.

**Links.** The app opens from the Apps Script /exec link, or from GitHub Pages at https://trcdulag.github.io/ict-inventory-pms/ (the page there calls the same /exec link, set as `DEFAULT_URL` in the page). Both use the same Sheet and passcode.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Paste it into Apps Script as the HTML file `Index`. |
| `apps-script/Code.gs` | The Google Sheet backend. It also serves the page at the app link. |
| `Register/ICT Inventory and PMS Register (ICTU).xlsx` | An empty Sheet template, with the tabs Inventory, PM Log, Checklist Results, Audit Trail, Lists and About. The filled copy (the RIS units and PM-2026-001) is kept outside this repo, because the repo is public. |
| `src/index.src.html` | The page source without the logos (`npm run build` makes `index.html`). |
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

The *Add office* button adds an office to the Lists tab. Both buttons are logged in the Audit Trail. The masterlist stays in the Sheet only; it is never put in this repo.

## Day to day

- **Adding equipment.** Inventory tab, *Add equipment*. Or paste many rows straight into the Inventory tab of the Sheet with the Equipment ID left blank. The next time the app opens it gives each row an ID and notes it in the Audit Trail.
- **Doing a PM.** Home or PMS Schedule, *Start PM* on the unit (or the Do PM tab and search). Fill in sections A to E, then *Save PM record*. Print the filled form for the end user and the Head of the ICT Unit to sign, then file it with the ICT Unit.
- **A wrong PM entry.** PM Records, open it, *Void this record* and give the reason. It stays in the Sheet marked Voided, and the unit goes back to its previous PM date.
- **Lists.** Offices, staff names and positions, equipment types with their default PM frequency, work types and conditions are in the Lists tab of the Sheet. Edit them there (you are the owner) and press Refresh in the app.

## Record control (ISO 9001:2015, clause 7.5)

- Every tab is protected. The app writes through the script, and only with the ICTU passcode.
- Nothing is deleted. PM records are voided with a reason; equipment is marked Disposed.
- Each PM record has a SHA-256 **record hash** of its details, checklist answers and signature. Run `verifyRecords` in Apps Script to check that no saved record was edited by hand. The result goes to the Audit Trail.
- The Audit Trail tab lists every added or edited unit (with the old and new values), every PM saved or voided, setup and verify runs, with the server time and the device.

The effectivity date of COH-IDN-F-02 Rev. 01 is blank on the form, so it prints blank. Put it in `FORM.effectivity` at the top of `Code.gs` once the QMS document controller gives it.

## For developers

```
npm run build      # src/index.src.html + logos -> index.html
npm test           # backend rules on a mock of Google services
npm run dev        # local server on http://localhost:8787 with made-up test data (Sheet link http://localhost:8787/api, passcode 1234)
npm run test:e2e   # browser test with Playwright
node dev/headers.js > /tmp/heads.json && python3 dev/make-register.py /tmp/heads.json   # rebuild the Sheet template
```
