# Cross-store leak test: coverage floor back above 0.6 (2026-10-31, #969)

`packages/api/test/cross-store-leak.test.ts` only. No migration, no app code.

- AI runs on the mock model during the walk (`AI_PROVIDER=mock`, gateway keys cleared,
  `AI_UNLIMITED_STORES=leak-a,leak-b`, restored in `afterAll`). The six AI procedures that were
  skipped for "a dev .env key would reach the real gateway" are walked now.
- `NAMESPACE_TABLE` maps the namespaces whose `id` was falling back to a product id: catalogs,
  shipping profiles, inbox (conversations, quick replies, knowledge, blocks), reviews, suppliers,
  inbound shipments, purchase charges/documents, API access, billing usage bills, automations
  (and runs), short links, business GST, monthly expenses, affiliates (programs, creatives,
  blocklist, commissions, payouts), pixels (and log), analytics saved reports, AI actions.
  Plus `workflowId`, `programId` aliases and three per-procedure keys.
- Delete/remove procedures take each table's second seeded row, so a delete early in the walk
  leaves the first row for the namespace's later procedures.
- Floor raised from 0.59 to 0.62. Not run here (owner runs the suite on dev); expected about
  0.64. If it lands under, run with `LEAK_DEBUG=1` to see the refusals by code.
