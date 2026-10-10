# "Report a bug" button on the test server (2026-10-05)

Owner decision: our own small button, no Sentry or SaaS; test server only (env flag), for every
signed-in admin member there.

- **Env** (`packages/config/src/env.ts`): `BUG_REPORTS_ENABLED` (default false; true/false/1/0/
  yes/no), `GITHUB_ISSUES_TOKEN` (fine-grained, only Issues: write on the repo),
  `GITHUB_ISSUES_REPO` (default `Viora-Tech/e-commerce`), `SOURCE_COMMIT` (optional). Enabled
  without a token: development prints the would-be issue to the admin server console; production
  refuses to start with a sentence naming the fix (`loadEnv` now appends cross-key rule messages
  to the key list). Also in `.env.example`, `deploy/env.production.example` and x-app-env.
- **API**: `bugReports.create` (`packages/api/src/routers/bug-reports.ts`) on the new
  `storeProcedureDetached` (any member, staff included; no permission; no transaction held while
  GitHub answers). Refused when off; 10 an hour per person. Service
  `packages/api/src/services/bug-report.service.ts`: secret scrubbing, the issue markdown, PNG/JPEG
  check (2 MB), screenshot upload through the store's storage under
  `stores/<storeId>/bug-reports/<uuid>.png` (inside the store folder so store deletion removes it),
  GitHub `POST /repos/{repo}/issues` with labels `bug` + `test-server`. `fetch` is injected via
  `ApiContext.githubFetch`. Tests: `packages/api/test/bug-reports.test.ts` (13).
- **Admin**: bug button bottom-left of the page panel (above Next's dev badge on phones) and
  "Report a bug" in the account menu, only when enabled and a store is active. Screenshot with
  modern-screenshot (MIT, lazy-loaded) before the dialog opens. Recent-errors ring buffer
  (`lib/client-errors.ts`) is installed in `instrumentation-client.ts` rather than a React
  provider so it also catches errors during hydration. Copy `data/bug-report.ts` + Hindi.
- **Docs**: developer docs Operations → Bug reports. Credited in `THIRD_PARTY_NOTICES.md`, listed
  in `docs/open-source-radar.md`.
- **Follow-up**: the Release checklist page (PR #269, not merged when this was written) should
  link here from its "Bugs" section: "Testers on the test server can use the admin's **Report a
  bug** button (Operations → Bug reports); it files the issue for them."
