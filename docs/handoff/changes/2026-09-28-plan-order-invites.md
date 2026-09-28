# Paid plan orders invite the buyer to create a store

**Paid plan orders invite the buyer** (28 September 2026, `feat/plan-order-invites`, no
migration). The platform sells its own plans from one of its own stores. Set
`PLATFORM_SALES_STORE_ID` to that store's id and tag each plan product `platform-plan`. When
an order there is paid (`order.paid` outbox row), the buyer's order email gets a signup invite
valid for a year, so they sign in to the admin with that email and land on /onboarding. No
`bun run platform:invite` needed. Code: `packages/core/src/onboarding/plan-invites.ts`, hooked
in `outbox/relay.ts` (`salesStoreId` dep, set by `apps/worker/src/outbox-relay.ts`).

Only the configured store counts, so another merchant tagging a product gets nothing. A buyer
with a live invite is left alone, so a repeated dispatch never issues a second one.

**Open**: no invite email yet. Access works by matching the signed-in email, so put "sign in at
<admin address> with this email" in the plan product's description or the store's order
confirmation. Plans are one-time payments (no recurring billing yet).
