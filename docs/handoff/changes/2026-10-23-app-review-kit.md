# App review kit: legal pages, app icons, submission sheets

Prepares everything Meta, Google and Shopify reviewers ask for, so the owner can create the
platform apps from PR #684 and submit them by copy-paste. Nothing was created, signed in to
or submitted.

## What changed

- **`integrations/SUBMISSION.md`**: per platform, field-by-field in console order: app
  settings, URLs (koomerce.app legal pages, `admin.koomerce.app` redirect URIs,
  `api.koomerce.app` webhooks), the permissions/scopes the code requests with justification
  text, reviewer instructions, screencast scripts with timings, Meta Business Verification
  document checklist, Google domain verification and OAuth verification, Shopify protected
  customer data answers and App Store listing copy. Every unknown is an `[OWNER: ...]`.
- **Icons** `integrations/assets/` (1200, 1024, 512, 120 px PNG, white K on #151515) and
  `generate-icons.ts` (`bun integrations/assets/generate-icons.ts`; uses packages/core's
  sharp, no new dependency).
- **www**: `/privacy` rewritten to cover data from Meta, Google (with the Limited Use
  disclosure) and Shopify, sub-processors, retention, deletion, security and the grievance
  officer (DPDP Act 2023 / IT Rules 2021); new `/data-deletion` (Meta's instructions page,
  with the status URL format `ADMIN/api/platform/meta/deletion?code=`); `/terms` gains
  "Connected platforms". Placeholders in privacy and terms are now `[OWNER: ...]`. Data
  deletion is in the footer's Legal column and the sitemap.

## Owner follow-up

Fill every `[OWNER: ...]` (list at the end of `integrations/SUBMISSION.md`), have a lawyer
review, then remove the template notice. Read SUBMISSION.md §3.1 (Shopify App Store policy
risk for a migration-off app) before paying a submission fee.
