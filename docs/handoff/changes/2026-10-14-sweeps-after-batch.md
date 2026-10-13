# Guard sweeps green after the 2026-10-14 batch

- **Test setup:** `prepareTestDatabases` retries migrations on Postgres "tuple concurrently updated". Packages migrate their
  test databases in parallel, and `ALTER ROLE app SET …` (0114) touches one shared catalog row.
- **Razorpay:** the webhook translation moved to `webhook-events.ts`. `razorpay.ts` drops from 510 to 385 lines.
- **Cashfree:** the same move. `cashfree.ts` drops from 627 to 493 lines, and its size allowlist entry is gone.
- **Size allowlist:** `apps/storefront/src/lib/liquid-theme.ts` (509 lines, already on dev) is listed as SPLIT.
- **Exports:** SEO and activity constants and helpers used only in their own module are no longer exported (no-orphans).
- **Headers:** the SEO test files carry the SOURCE OF TRUTH header.
