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
- **Still to build:** the report figures in core (net sales by the analytics formula, bars,
  history, sellers, sources, to-dos), weekly/monthly switches in Account → Notifications
  (`alert-prefs.ts`), and the worker job that sends them Monday 9:00 and on the 1st.
