# CLAUDE.md

DOH TRC Dulag ICT Inventory and PMS app. See README.md for how it works and how it is set up.

- `apps-script/Code.gs`: the Google Sheet backend. It also serves the page at the /exec link.
- `src/index.src.html`: the page source. Run `npm run build` to write `index.html` (adds the logos). `index.html` is what gets pasted into Apps Script as the HTML file `Index`.
- `Register/`: the Sheet template (made by `dev/make-register.py`).
- Tests: `npm test` (backend rules on a mock of Google services) and `npm run test:e2e` (browser, Playwright).
- The PM form is COH-IDN-F-02 Rev. 01 and the job order form is COH-IDN-F-01 Rev. 01 (ADM-HIMS-P-03). Keep their wording as on the forms.
- The request page (#request), the QR status page (#eq=ICT-0001) and the requestor's tracking page (#track=<token>) are public: never return staff names, serials or costs from `publicInit`, `eqInfo`, `submitJO`, `trackJO` or `rateJO`.
- Every other action needs a signed-in ICTU account (`session_`); its minimum role is in `NEED` in Code.gs (Viewer, Technician, Head). The server sets `req.by` from the session, never from the page.
- Each new version: bump `VERSION` (Code.gs), `APP_VERSION` (src/index.src.html) and package.json, and add the change to `CHANGES` in src/index.src.html and to CHANGELOG.md (the app's "What's new").
