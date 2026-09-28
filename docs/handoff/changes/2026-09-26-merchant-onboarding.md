# Merchant onboarding

**Merchant onboarding** (26 September 2026, `feat/onboarding`): `/onboarding` lets a signed-in
person with no store yet create one - store name and address (live availability, reserved
words) - via `createStore` (`packages/core/src/onboarding/service.ts`; transactional-per-step,
idempotent against double-submit). Gated by `MERCHANT_SIGNUP_MODE` (`invite` default, `open`):
in invite mode, no live invite means "Signups are invite-only for now" instead of the wizard.
No platform admin UI yet - `bun run platform:invite <email>` prints the link. Existing staff
invitations to an existing store are untouched. Store picker (`/select-store`) gained a
"Create another store" link. Migration `0070_signup_onboarding` adds `signup_invite`
(single-use, email-keyed) and a `store_slug_taken` SECURITY DEFINER function so the slug check
works before any store's RLS context exists.
