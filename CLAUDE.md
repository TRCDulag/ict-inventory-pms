# CLAUDE.md

DOH TRC Dulag ICT Inventory and PMS app. See README.md for how it works and how it is set up.

- `apps-script/Code.gs`: the Google Sheet backend. It also serves the page at the /exec link.
- `src/index.src.html`: the page source. Run `npm run build` to write `index.html` (adds the logos). `index.html` is what gets pasted into Apps Script as the HTML file `Index`.
- `Register/`: the Sheet template (made by `dev/make-register.py`).
- Tests: `npm test` (backend rules on a mock of Google services) and `npm run test:e2e` (browser, Playwright).
- The PM form is COH-IDN-F-02 Rev. 01. Keep its wording as on the form.
