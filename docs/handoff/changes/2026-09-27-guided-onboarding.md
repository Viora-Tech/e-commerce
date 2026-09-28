# Guided onboarding

**Guided onboarding** (27 September 2026, `feat/onboarding-guided-flow`): `/onboarding` is now one
question per screen with progress dots and Back: store name + address → what you sell (picture
cards → starter automatic collections keyed by tag) → where you are based (India default, state
for GST, written to `store.address`) → do you already sell somewhere (Shopify installs the
importer and lands on `/apps/shopify-import`). Answers on `store.business_profile`. Invite mode
shows a waitlist form (email, phone, what you sell; 5/hour per user and IP) into
`signup_waitlist`; `platform:invite` marks the row invited. Migration `0073_signup_waitlist`.
`bun run test:sweeps` is green again (onboarding + media headers, orphan fixes/allow-list).
**Main's migration chain needs a fix**: the #183 merge dropped `0071_media_pipeline` from
`_journal.json`, and the 0071 and 0072 snapshots both point at 0070, so `drizzle-kit generate`
errors with a snapshot collision on main (details in the PR).
