# BuildRight Liquid Glass Timesheets

BuildRight Liquid Glass Timesheets is a lightweight progressive web app (PWA) tailored for construction crews. Capture time by project, keep a living roster of your field team, and export polished PDF invoices for payroll or client billing—all without leaving the browser.

## Highlights

- 💎 Liquid Glass UI inspired by the latest iOS design language, complete with frosted panels and a floating tab bar.
- 💼 Maintain an always-ready crew list and job board with quick add/remove actions.
- 🕒 Log daily hours with tasks, notes, and billable status in a mobile-friendly card interface.
- 🔍 Filter the log by teammate, project, billable status, or date range and see results update instantly.
- 📤 Export PDF invoices for payroll or clients that respect your current filters.
- 📱 Works offline and can be installed like an app thanks to the included manifest and service worker.
- 🔒 All data is stored locally in the browser via `localStorage`, making it ideal for tablets on the job site.

## Getting started

1. Serve the folder with any static file server (for example `python -m http.server`) and open `index.html` in a modern browser (Chrome, Edge, Safari, Firefox).
2. Visit the **Crew** and **Projects** tabs to enter your team and job information.
3. Switch to **Daily log** to record hours. The date defaults to today for quick entry.
4. Use the filter card to focus on a specific person, project, billable status, or date range.
5. Open the **Reports** tab to review totals and export payroll or client PDF invoices.

To install the app on desktop or mobile, tap **Add to Home Screen** in the header when prompted. The app will keep working offline after the first successful load.

## Development notes

- The interface is built with vanilla HTML, CSS, and JavaScript—no build step required.
- Static assets are precached by the service worker using a "cache with network update" pattern.
- Clearing the site data in your browser resets the application to a clean slate.
