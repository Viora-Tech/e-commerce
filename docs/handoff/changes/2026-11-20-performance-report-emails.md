# Weekly and monthly performance report emails (20 Nov 2026)

Branch `feat/performance-email-redesign`. Email layout only; nothing sends the weekly or
monthly report yet.

- **Design:** Figma "Weekly report · final" (1008:10578) and "Monthly report · final"
  (1008:10781), Moodboard → Batch 10 · Reports. Times New Roman, the logo on a black band behind
  the top of a white card, purple only on the best bar, this period, the top source and links.
- **Messages:** `staff_weekly_report` and `staff_monthly_report` (email only) in the catalogue,
  `TEMPLATE_IDS`, the admin names (English and Hindi) and the WhatsApp params switch.
- **Layout:** `emails/performance-report.tsx` (band, card, footer) and
  `emails/performance-report-parts.tsx` (bars, stats, history, top sellers, sources, to-dos with
  icons, money). Only these emails use them; the shared blocks from `feat/email-redesign-base`
  are separate. `renderEmail` uses it for the daily summary, weekly and monthly reports whenever
  `TemplateData.report` (`report-types.ts`) is set; without it the old layout stays.
- **Copy:** each report's own words come in the report; the fixed words (Net sales, Where your
  buyers came from, Analytics, Notification settings, the figures note) are `reportWords` in
  `templates/content-reports.ts`, with the subject and plain-text part.
- **Logo:** `storeEmailDarkLogo` reads an imported theme's `logo_dark` into
  `EmailBrandInfo.logoDarkUrl`; without one, the band is light behind the normal logo.
- **Samples:** `samples-reports.ts`, figures from the Figma frames, generic product names, no
  images. Tests: `packages/notifications/test/performance-report.test.ts`.
- **Sending (second commit):**
  - `core/member-account/report-periods.ts` (which days, the period before, bars, history;
    pure), `report-compose.ts` (figures → formatted report; pure), `report-figures.ts` (the
    reads), `reports.ts` (`sendDueReports`: Monday / the 1st from 9:00 IST, email only, once
    per member and period via `lastSentOn` claimed in the update).
  - Same rules as Analytics: Analytics' session, sales-breakdown, SQL-bucket and rate helpers
    moved from `packages/api/src/services` to `core/src/analytics-figures/`
    (`@commerce/core/analytics-figures`); the old api files re-export them. Net sales is the
    sales breakdown's net (gross − discounts − returns); cancelled, draft and test orders out.
  - Words: `reportCopy` in `notifications/src/templates/report-copy.ts`.
  - Account → Notifications: `weeklyReport` and `monthlyReport` switches (email only) in
    `alert-prefs.ts`, the page and `data/account.ts` + Hindi overlay.
  - Worker: `member-reports` job every 10 minutes (`apps/worker/src/member-reports.ts`),
    stores from `stores_with_member_reports()` (migration `0260_member_reports`, renumbered at merge; was renumber at
    merge if another branch took 0258).
  - The daily summary now carries `report` too, so it renders in the new layout. The dark logo
    reaches every email through `withEmailBrand` → `storeEmailBrand`.
