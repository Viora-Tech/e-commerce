# Bug report status (Account → My reports)

Branch `feat/bug-report-status`. Migration **0187_bug_report** (after 0185 on dev; 0186 is the
staff console's, PR #952; 0188 planned for role approvals).

- **Table** `bug_report` (`packages/db/src/bug-report-schema.ts`): one row per "Report a bug"
  report beside its GitHub issue. `store_id` + `apply_store_rls()`, so every read and write runs in
  `withStore` and a store sees only its own reports. Two `SECURITY DEFINER` functions return only
  store ids for the webhook and the poll (`bug_report_stores_for_issue`, `stores_with_bug_reports`).
- **Statuses**: received → in progress → fixed (next update) → live, or won't fix. Rules are pure in
  `packages/core/src/bug-reports/sync.ts`; the apply step is `github-sync.ts`, idempotent.
- **Webhook** `apps/admin/src/app/api/github/webhook/route.ts`: `X-Hub-Signature-256` checked in
  constant time with `GITHUB_WEBHOOK_SECRET` (401 on mismatch, 404 with no secret), other repos
  ignored, repeated delivery ids skipped, rate limited.
- **Worker** `apps/worker/src/bug-report-sync.ts`: every 15 minutes, re-reads up to 40 open reports'
  issues as a fallback for missed deliveries. Only with `GITHUB_ISSUES_TOKEN`; the token lives in
  the GitHub client (`github.ts`) and is never logged.
- **Telling the reporter**: My reports page (`/account/bug-reports`), unread dot on the account menu,
  the bell for fixed/live, and `bug_report_update` messages on the channels the member keeps on under
  **Your bug reports** in Account → Notifications (email on by default; WhatsApp opt-in, through the
  store's own WhatsApp channel to the Profile mobile, logged in `notification`).
- **Docs**: developer docs Operations → Bug reports (setup, flow, isolation); merchant guide
  Settings → Your account (My reports, the new alert row).
- **Tests**: `packages/core/src/bug-reports/sync.test.ts`, `github-sync.test.ts` (webhook, poll,
  release → live, email/WhatsApp prefs, store isolation), `packages/api/test/bug-reports.test.ts`.

## Left out

- `/platform/reports` (staff set status and reply from the admin) waits for the staff console,
  PR #952. Until then the team replies and changes status on GitHub; the admin follows. The
  GitHub write calls (comment, close, label) were removed from `github.ts` so nothing unused ships.

## Owner actions on the test server

1. `GITHUB_WEBHOOK_SECRET` on the admin app; `ADMIN_URL` on admin and worker.
2. Repo webhook to `<ADMIN_URL>/api/github/webhook` (Issues, Issue comments, Pushes, Pull requests).
3. Token needs **Contents: Read** as well as Issues: Read and write.
4. WhatsApp only: a Meta template `bug_report_update` with four body placeholders (store, title,
   status text, link) on the store's WhatsApp account.
