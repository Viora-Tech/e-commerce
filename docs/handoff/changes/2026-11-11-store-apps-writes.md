# store.apps: every writer takes the row lock, and a sweep keeps it so (11 Nov 2026)

Fixes #1523. Follow-up to #1482, which added `lockStoreApps` (SELECT … FOR UPDATE,
`packages/core/src/apps/locked.ts`) and moved most writers onto it.

- Still unlocked before this PR, now locked: Taxes & GST `saveTaxes`
  (`packages/api/src/services/taxes.service.ts`), `saveStoreProfile`'s prices-include-GST switch
  (`packages/core/src/settings/store-profile.ts`, used by the Shopify importer), and the secret
  rotation's apps re-encryption (`packages/core/src/secret-rotation.ts`, when `apply`).
- Writers that locked by hand now use the shared helper: app uninstall and disconnect
  (`apps.service.ts`), EMI & pay later, GrowthBook, Meilisearch.
- New sweep `store-apps-writes` (docs/guardrails.md, z): a file that writes `apps` on `store`
  without calling `lockStoreApps` fails. The allow-list is empty.
- Test: `packages/core/src/apps/locked.test.ts` races `saveStoreProfile` against an app install;
  it fails with the lock removed.

The row lock was kept over per-key `jsonb_set`: installs change the shared `installed` list, and
the lock covers every writer with one rule.

Not run here: the `packages/api` test suite (this worktree could not install `@aws-sdk/*`, so the
suite does not load). The api package typechecks clean apart from those missing modules.
