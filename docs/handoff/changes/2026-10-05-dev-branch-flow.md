# `dev` integration branch, nightly test-server deploys

- New `dev` branch (default branch on GitHub). Feature/fix PRs go into `dev`; `main` only moves
  by a `dev` → `main` release PR. GitHub auto-deletes merged branches.
- The test server (Dokploy on EC2, vioratech.in) now builds `dev`. Auto-deploy is off; a nightly
  job at 02:30 IST deploys worker → admin → storefront one at a time, only the apps whose watch
  paths changed (read-only deploy key on the server).
- Docs: CLAUDE.md "Branches" bullet; developer docs Deployment → "Branches: dev and main" and
  "Test server deploys".
