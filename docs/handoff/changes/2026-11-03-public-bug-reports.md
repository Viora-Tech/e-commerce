# Public bug reports

- New env `GITHUB_CODE_REPO` (default `Viora-Tech/e-commerce`). When `GITHUB_ISSUES_REPO`
  differs from it, issues are treated as public (`issuesArePublic`, core `bug-reports/client.ts`):
  the issue body leaves out the store, reporter and screenshot, and strips ids and the query
  from the page address. Everything is still saved with the report in the admin.
- The "Report a bug" dialog adds a notice that the report is posted publicly (en + hi).
- The GitHub client checks fix commits (`contains`) in the code repository; the webhook takes
  issue/comment events from the issues repository and push/PR events from the code repository.
- To switch the test server to `Viora-Tech/koomerce-issues` (manual, in Dokploy on admin and
  worker): set `GITHUB_ISSUES_REPO=Viora-Tech/koomerce-issues`; give the token Issues: Read and
  write on koomerce-issues plus Contents: Read on e-commerce; create labels `bug` and
  `test-server` on koomerce-issues; add the same webhook to koomerce-issues. Fix PRs then say
  `Fixes Viora-Tech/koomerce-issues#n`.
- Docs: developer docs, Operations > Bug reports > Public issues.
