# Changelog

What changed in each version of the ICT Inventory and PMS app. The app shows the same list under *What's new*.

## 1.7.7 (Nov 4, 2026)

- Section notice and PMS result form: new "Date done" and "Done by" columns per unit, from the PM record or the job order. Names show as "Bro." plus first name, with James shown as Bro. Jhedd.

## 1.7.6 (Nov 4, 2026)

- Printed PMS schedule (COH-IDN-F-04): done quarters are green, overdue quarters light red, planned quarters white with a blue boxed P, plus a color key.

## 1.7.5 (Nov 4, 2026)

- Scan code works where the browser has no QR reader of its own (Windows and Mac browsers, iPhone): frames are read with jsQR 1.4.0 (Apache-2.0, inlined by the build). Clear messages when the camera is blocked or missing.
- Scan code: take or pick a photo of the QR label.

## 1.7.4 (Nov 4, 2026)

- Fix: the employee window's section lists left out sections that only the equipment list had, so adding one (Dental Unit) looked like it did nothing. They now use the same list as the rest of the app.
- Remove a section (Head): only when no equipment or employee has it; asks twice; also taken off designations. Saved records keep the old name.

## 1.7.3 (Nov 4, 2026)

- One-page forms fit the page at 100% scale on A4 or short bond (Letter): a sheet that runs up to 25% over is shrunk to fit, with a 5% allowance for printer margins. Long lists still run onto more pages.
- Employee masterlist: Add a section / unit button (also inside the employee dialog), and Employment (plantilla / regular, Job Order Employee, GIP, Contract of Service), saved in a new Employment column of the Employee Changes tab.

## 1.7.2 (Nov 4, 2026)

- Do PM shows the picked unit's next PM, last PM and job orders done this quarter.
- PM by section: Clear this quarter's plan (Head) cancels the plans so they can be made again; started or done plans are kept. Cancelled rows stay in the PM Plan tab.
- Quarter list starts at Jan-Mar of the current year. A past quarter is planned from its first day (it was planned from today before).
- Blank forms and lists is one dropdown; the doubles (PMS checklist, inventory masterlist, PMS schedule) are listed once under F-02, F-09 and F-04.

## 1.7.1 (Nov 4, 2026)

- Employee editor: the "Also assigned to" checkboxes line up with their section names; ticked ones on top and highlighted, with a search box and a "Ticked:" line. The home section cannot be ticked.

## 1.7.0 (Nov 4, 2026)

- PM only for desktops / PCs, printers / photocopiers, laptops, tablets, smart TVs and servers. Other equipment has no PM.
- PM windows follow the quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec); servers every 6 months. Next PM Due is the first day of the next window. A unit never serviced is due in the window after the one it was bought in.
- A job order resolved with action taken counts as the unit's PM for that quarter. The unit, the schedule and the job order show the action and how many were done within the quarter.
- New "PM Plan" tab: section plans per quarter (2 working days each, Monday to Thursday, or with Fridays), quarter schedule, notice per section, and the PMS result form signed by the section head or representative.
- Do PM opens on the list of sections; the search still finds any unit.
- New "Employee Changes" tab: edit an employee's home section, other sections (designation), position and status from Accounts. The HR Masterlist tab is never changed. Rename a section moved to Accounts.
- Backups can be emailed as an Excel file to one ICTU staff (Accounts, Backup).
- Blank brand / model becomes "Generic". The catch-up schedule is removed (the section plan replaces it).
- Blank forms and lists follows the ISO Documents list.

## 1.6.6 (Nov 4, 2026)
- Router setup now fits the office MikroTik (CCR1009, RouterOS 6.49): it checks PLDT through "ISP IN" and Starlink through 192.168.1.1, and sends its reports only while the router can reach the internet.
- While ether6 (PLDT) is switched off on purpose, PLDT is not logged as down.

## 1.6.5 (Nov 3, 2026)
- Internet Downtime is now logged by the MikroTik router by itself. It checks PLDT and Starlink every 30 seconds and tells the app the minute a line goes down or comes back, even at night. If both lines are down, it sends the report with the right time once a line is back.
- Router setup (Head) on the Internet Downtime page gives the commands and the script to paste in Winbox, with the app's link and a secret key already filled in.
- The screenshot upload from 1.6.4 was taken out, since the router now keeps the record. Entries logged by the router say so in the list.

## 1.6.4 (Nov 3, 2026)
- Internet Downtime: attach screenshots to each entry as proof, such as the router interface list, a speed test or the ISP's text. Press Ctrl+V in the form to paste one, or choose files. Up to 10 per entry.
- The screenshots are kept in a Drive folder "ICT PMS Downtime Screenshots". Click one to see it full size, and the monthly report shows how many each entry has.
- Run setup once in Apps Script so the Internet Downtime tab gets its new Screenshots column.

## 1.6.3 (Nov 3, 2026)
- Internet Downtime: since PLDT is the main line and the router switches to Starlink by itself, the office is now counted as without internet only while both lines are down at the same time. Each line still shows its own uptime.
- New scope choice "Backup line took over". It is picked by default when you record one line, and "Whole office" is picked when you choose All internet lines.

## 1.6.2 (Nov 3, 2026)
- Internet Downtime: the PLDT line (router ether6, ISP IN) and the Starlink line (router ether7) are now in the list from the start, so you can pick them right away. They show under Network and IP, where you can add the bandwidth, account no. and monthly cost.

## 1.6.1 (Nov 3, 2026)
- New Internet Downtime page: record each time the internet goes down, with the line, the time it went down and came back, the cause and the ISP ticket. The app works out the hours.
- Each month shows the uptime of every line and how long the whole office had no internet. Print the monthly report for ISO or for a rebate request to the ISP.
- While a line is down, a red note and a count on the menu stay up until someone presses "It is back now".
- Run setup once in Apps Script to add the Internet Downtime tab. List your internet lines under Network and IP (Kind: Internet Line) first.

## 1.6.0 (Nov 3, 2026)
- New ISO Documents page: every ICTU controlled document (procedures, forms, Context, ROA, APW) with its current revision, effectivity date and status, and the revisions and DRFs behind it. Marking a revision Approved updates the document by itself.
- Print the master list of documents, the DRF and revision log, the revision history of a document, and a copy of each form the app prints, for the audit.
- Setup adds the ISO Documents and ISO Revisions tabs with the ICTU documents known so far (COH-IDN-P-01, COH-IDN-F-01 to F-09, Context, ROA and APW). Codes F-03 to F-09 are proposed until the DCO confirms them.

## 1.5.2 (Nov 3, 2026)
- Inventory: "For disposal" (Head) lists every Unserviceable unit with its serial, section, age and last job order or TIR. Tick units, print the list to attach to the IIRUP, then mark them Disposed in one go with the IIRUP no. and date. Disposed units stay in the masterlist for the record.

## 1.5.1 (Nov 3, 2026)
- Record a PM round: Tick all overdue only ticks the overdue units that match the search (for example only printers). With no match, it ticks all overdue units.
- Do PM: each unit in the list has a colored mark, red for overdue, blue for planned this month or soon, green for PM done and up to date.
- Dashboard: Due for replacement opens the list of those units with their specs, serial, section, age, useful life and costs. Click a unit to open it, or download it for Excel.
- The Tidy section names button is removed. Imports still use the agreed section names.

## 1.5.0 (Nov 3, 2026)
- Dashboard: click a bar in Equipment by section (or Condition) to open the inventory list for that section (or condition).
- Inventory: "Tidy section names" (Head) merges sections that are the same under two names, after showing the list first. For example RITD CHPO into Office of the Chief Health Program Officer (Residential/Inpatient Treatment Division), MSS into Medical Social Work Section, Cash Unit into Cash Operations Section, CAO into Office of the Chief Administrative Officer, and Main Office, IDTOMIS/IDADIN and ICTU into IDADIN/ICTU.
- Import from Excel uses the same section names, so imported units land in the merged sections.

## 1.4.9 (Nov 3, 2026)
- Inventory: "Rename a section" (Head) gives every unit under a section a new name at once, for example Main Office to IDADIN/ICTU. Saved PM records and job orders keep the name they had.

## 1.4.8 (Nov 3, 2026)
- Import from Excel: an end user who is not in the employee masterlist is left out, and the unit stays under its section. Short names like "L. Panopio", "Girlie P." or a first name alone are matched too when only one employee fits.

## 1.4.7 (Nov 3, 2026)
- PMS schedule: "Record a PM round" saves one PM record for each ticked unit at once, with the same date and result. For PMs that were done; the date cannot be in the future.
- PMS schedule: "Catch-up schedule" (Head) gives every overdue unit a new PM date on the coming working days, a set number a day. It plans the PMs; it does not mark them as done.

## 1.4.6 (Nov 3, 2026)
- Import from Excel: each end user is changed to the nearest name in the employee masterlist (for example "ENGR. ORACION" to the full name). The message after the import lists every name it changed and the ones it could not find.

## 1.4.5 (Nov 3, 2026)
- Import from Excel: a unit with no serial no. and no ICT ID (as from a paper PM report) is not added twice. When the same type, brand, office and end user is already in the masterlist, its PM records go to that unit.

## 1.4.4 (Nov 3, 2026)
- Job order request: the type of request now comes first, and the form only asks what fits it. Network and ICTU service requests (data request, ID printing, layout, event support) no longer show the equipment fields.
- Event support asks for the venue. The Section / Unit Head line shows only for items marked *, and the data privacy consent only when a device is involved.
- The same applies when ICTU logs a job order in the app. Fields that already have something in them stay shown.

## 1.4.3 (Nov 3, 2026)
- If the app is already open in a window, the "Open in the app" link in a job order email goes straight to that window and opens the job order. The extra tab closes itself, and the old "open in another tab" box is gone. A new window opens only when the app is not running.
- If you are in the middle of a form or a PM when the link comes in, the job order waits in a small note so nothing you typed is lost.
- The installed app (Edge or Chrome) is set to reuse its open window for links.

## 1.4.2 (Nov 3, 2026)
- Opening the app when already signed in (for example from the job order email) shows "Opening the app…" instead of the sign-in form while the data loads.
- The link in the test email now says it is a test, instead of opening an empty list.

## 1.4.1 (Nov 3, 2026)
- Only one tab of the app stays active. Opening the app again, for example from the link in a job order email, takes over, and the older tab stops (and closes itself where the browser allows it).

## 1.4.0 (Nov 2, 2026)
- New job orders: while the app is open it checks every 2 minutes. A new request shows as "N new" on Job Orders, with a pop-up and a short sound (three notes when urgent).
- New job orders: desktop alerts, even when the browser is minimized. Turn them on from your name menu.
- New job orders: an email for each request from the request page. The Head sets the addresses under Accounts and can send a test email.
- Phones: Home, Inventory, Do PM and Job Orders sit in a bar at the bottom. More opens the rest.
- Phones: each unit in the masterlist shows as a small card, and the column names are bigger buttons for sorting.
- Dashboard: PM up to date says how many units never had a PM yet. Due for replacement says how many units have no date acquired, instead of only showing 0.
- A "Still saving" note when the Google Sheet is slow to answer, so the page is not closed halfway.
- Lists can be opened with the keyboard (Tab, then Enter). The page is lighter to load.

## 1.3.9 (Oct 29, 2026)
- A What's new list (this one), in the menu and on the sign-in card.

## 1.3.8 (Oct 29, 2026)
- PMS Schedule: Print calendar by section, one 12-month calendar page per section to hand to the section head, with Prepared by and Received by.
- PMS Schedule: Sort by section, equipment ID, name, type, next PM date or frequency.

## 1.3.7 (Oct 29, 2026)
- Inventory: click a column name to sort by it; click again to reverse.
- Inventory: the list scrolls inside its own box, and the column names stay in view.
- The Home notice now tells an old page (press Ctrl+F5) apart from an old Apps Script.

## 1.3.6 (Oct 29, 2026)
- Add equipment: Read property sticker. A photo of the yellow DOH TRC DULAG PROPERTY sticker fills in the type, brand, property no., ICS/PAR no., accountable officer and cost (needs a free Gemini key).

## 1.3.5 (Oct 29, 2026)
- Inventory: Add equipment is now at the top of the list.
- Fixed: an employee pick list could close by itself when you clicked back into the box quickly.

## 1.3.4 (Oct 29, 2026)
- Inventory: Import from Excel (Head only). Brings in Inventory and PM Log rows from an .xlsx or .csv and skips what is already there.
- A unit whose ID is taken by a different unit gets the next free ID, and its PM records follow it.

## 1.3.3 (Oct 29, 2026)
- Home: a notice when the Apps Script is behind the page, and help when there is no equipment yet.
- Failed sign-ins with made-up usernames no longer fill the Audit Trail.
- Small layout fixes (Condition filter, Start PM button).

## 1.3.2 (Oct 29, 2026)
- Job Orders: the request QR poster prints on half an A4 (A5) with the official header.

## 1.3.1 (Oct 29, 2026)
- New app icon: the server stack with the TRC Dulag seal.

## 1.3.0 (Oct 29, 2026)
- Personal sign-in for each ICTU staff, with roles: Head, Technician and Viewer.
- Monthly backup of the Sheet to Google Drive, plus Back up now.
- Requestors rate the service (CSM) from a link or QR code once the job order is closed.
- New: Transfers (PAR/ICS), Spare Parts stock, Technical Inspection Report, replacement plan, cost per unit, Dashboard, Incidents and Network and IP.

## 1.2.0 (Oct 28, 2026)
- Job orders (COH-IDN-F-01), the public request page, and QR labels on each unit.
- New header, better pick lists and the data privacy notice.

## 1.1.0 (Oct 28, 2026)
- Document Tracking look, employee lists from the HR masterlist, Add office and Add employee.

## 1.0.0 (Oct 28, 2026)
- First version: inventory masterlist, PM form COH-IDN-F-02, PM log and PMS schedule.
