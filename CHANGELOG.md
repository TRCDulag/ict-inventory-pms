# Changelog

What changed in each version of the ICT Inventory and PMS app. The app shows the same list under *What's new*.

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
