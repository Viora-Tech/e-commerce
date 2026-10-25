# Affiliates v1.1, final: creatives, signup questions, application emails, trends

Stacked on PR 4a (#762). Finishes the v1.1 design (`docs/superpowers/specs/2026-10-24-affiliates-parity-design.md`): PR 4b, 5 and 7 in one.

- Migration `0171_affiliate_final`: `affiliate_creative`, `affiliate_click_day` (PK store, affiliate, IST day), `affiliate.answers`, `rejected_at`, `reject_reason`.
- **Creatives** (`src/creatives.ts`, admin page `creatives`, `MediaPickDialog`): per program or all; dashboard "Ready to post" (save image, copy caption).
- **Signup questions**: `ProgramRules.form` (up to 10: text, textarea, url, number, select, checkbox; required or not), `cleanAnswers` keeps answers to the form; storefront apply form renders them; admin program editor `SignupFormCard`; answers on the affiliate page. File-upload questions are not built (private uploads), left for later.
- **Emails**: outbox `affiliate.applied` (manual-approval storefront applications) → new merchant template `affiliate_application` (`deliverToStoreContact`, links the admin page); `affiliate.rejected` → `affiliate_update` kind `rejected` with the merchant's note. Reject now opens a dialog with an optional note.
- **Trends**: clicks per day; `affiliateTrend` (12 weeks or months, sales/commission/orders/clicks), `topProducts` (commission shared over lines by value), `conversionPercent`, `ledgerCsv`. Admin overview `AffiliateTrendCard` (weekly/monthly bars, conversion, top products, ledger CSV); portal "Your last 12 months" chart.
- API: `affiliates.trend`, `ledgerCsv`, `creatives.{list,save,archive}`, `setStatus` takes `reason`.
