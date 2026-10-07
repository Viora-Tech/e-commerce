# Report a bug: say why GitHub refused

- **Problem:** every failed report showed "GitHub did not take the report. Try again in a minute",
  even when the cause was the admin's GitHub token (wrong, expired, no access, not approved by the
  Viora-Tech org). Retrying never helps in those cases.
- **Change:** `githubIssueProblem(status, repo)` in `packages/api/src/services/bug-report.service.ts`
  turns GitHub's answer into a plain sentence (401 token wrong/expired; 403/404 token can't create
  issues in the repo; 410 issues off; 422 labels; 429 rate limited; no answer = unreachable). The
  router uses it and logs `[bug report] GitHub answered <status> (repo …)`. The token is never shown.
- **Test:** `packages/api/test/bug-reports.test.ts` (14 pass).
- **Owner action:** fix the token per the message (see developer docs → Operations → Bug reports).
