# Unlimited plan for Koomerce's own stores

Branch `feat/unlimited-store`. Migration `0181_unlimited_store` (`store_plan.unlimited`, AI tier
`internal` added to `ai_settings_plan_check`). Owner, 2026-10-29: Waimers gets a plan with no
limits.

- **Switch:** `bun run platform:unlimited <slug>` (`--off` to undo), `setStoreUnlimited` in
  `packages/core/src/billing/unlimited.ts`. Merchants can never set it.
- **On:** plan Scale (its features), `status` active; no staff or storage limit
  (`staffSeats` / `storageRoom` return null), no per-order fee (`loadMonthFeeInputs` gives no
  paid periods), no renewals, due or pause (`runBillingSweep` skips it), no fair-use notice,
  `choosePlan` refuses (`UnlimitedPlan`, CONFLICT). AI tier `internal`: 50,000 credits a month,
  a safety cap (about ₹5,000 at full use). Automations keep Scale's 200,000 runs a month.
- **Admin:** Plan & billing shows an "Unlimited" card with this month's use and apps; no
  Compare plans, payment, bills or downgrade. The sidebar usage card is hidden.
- Test: `packages/core/src/billing/unlimited.test.ts`.

## At release
After the deploy runs the migration, run once in the worker container, from `/repo/apps/worker`
(the image has no root `package.json` script; the file ships at `ops/`, #953):
`bun ops/platform-unlimited.ts waimers`. Locally it stays `bun run platform:unlimited waimers`.

## Migration order
Rollouts (`feat/rollouts-r1`) also adds a `0181_`. Whichever lands on `origin/dev` second
renumbers and re-stamps its `when` later than everything there.
