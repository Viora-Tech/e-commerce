---
name: koomerce-release-flow
description: The Koomerce branch, commit, handoff-note and merge workflow - branch from origin/dev, owner checks on localhost, merge to dev, test on dev, release dev to main. Use when starting a change, writing a commit or PR, adding a docs/handoff/changes note, linking a bug issue with Fixes #n, adding or merging a database migration, or preparing a release.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Branch, merge and release flow

Sources: `CLAUDE.md`, `apps/docs/content/developer-docs/operations/deployment.mdx` ("Branches",
"Releasing to production", "Migrations") and
`apps/docs/content/developer-docs/operations/release-checklist.mdx`.

## The flow

1. **Branch from `origin/dev`**, one branch per change, descriptive name (`feat/...`, `fix/...`,
   `docs/...`):
   ```sh
   git fetch origin
   git checkout -b fix/short-name origin/dev
   ```
   In a reused worktree whose branch is merged, the same two commands work; if HEAD does not
   move, point it with `git symbolic-ref HEAD refs/heads/<branch>` and reset to `origin/dev`.
2. **Build it**, following `koomerce-conventions`. Commit on the branch.
3. **Owner checks on localhost** (admin 3200, storefront 3100). Do not push, open a PR or merge
   unless the owner asked for it in this session.
4. **Merge into `dev`** after the owner's OK (PRs target `dev`; `gh pr create` defaults to it).
   Fixes found while testing on `dev` may be committed straight to `dev` when the owner allows
   it; typecheck and run the touched tests first.
5. **Test on `dev`**: the full suites run there in one batch (`koomerce-testing`). The test
   server (vioratech.in) runs `dev`, deployed by hand.
6. **Release** `dev` to `main` by a release PR, after the smoke checklist. The owner releases;
   do not remind them to. Merging the release PR deletes `dev` on GitHub (auto-delete): restore
   it (`git push origin <old dev tip>:refs/heads/dev`) and move any PR GitHub retargeted to
   `main` back to `dev`.
7. Production deploy: worker first (it applies migrations on start), then admin, then storefront.

Hotfix for production: branch from `main`, PR into `main`, then merge `main` back into `dev`.

## Every change records a handoff note

Add a **new** file `docs/handoff/changes/YYYY-MM-DD-short-title.md`; never edit
`docs/handoff.md` (parallel PRs would conflict). Rules: `docs/handoff/changes/README.md`.
Template: [handoff-note-template.md](handoff-note-template.md). Good examples:
`2026-11-20-simple-rules-rule-price.md`, `2026-11-18-draft-order-store-credit.md`.

## Bugs and commits

- Every bug is a GitHub issue with the `bug` label. A fix commit or PR says `Fixes #n`.
- Write `@name` only for a real login you mean to notify.
- Commit trailers come from the session's instructions; end every message with them.
- Never commit `.env`, credentials or `.claude/settings.local.json`.

## Migrations: order matters

Migrations live in `packages/db/drizzle/` (`NNNN_name.sql`) with
`packages/db/drizzle/meta/_journal.json`. `packages/db/src/migrate.ts` applies them (the worker
runs it on start).

**Drizzle skips a migration whose journal `when` is older than one already applied.** It only
runs entries newer than the last applied `created_at`, and says "migrations applied" anyway.
Branches that each add a migration get merged in any order, so at merge time:

1. Renumber each branch's migration to the next free number in apply order (rename the `.sql`
   and its `tag` in `_journal.json`).
2. Give it a `when` later than every entry already merged.
3. After `bun run db:migrate`, check the new columns or tables really exist.

Also: write migrations additively (a new nullable column, not a rename) so a same-day rollback
works; app tables carry `store_id` and end with `SELECT apply_store_rls();`; app schemas are
listed in `packages/db/drizzle.config.ts`.

## Docs that move with code

- Developer docs: `apps/docs/content/developer-docs/...`; merchant guide:
  `apps/docs/content/merchant-guide/...`; navigation in each folder's `_meta.ts`.
- `cd apps/docs && node scripts/check-links.mjs` checks internal docs links (cheap, no build).
