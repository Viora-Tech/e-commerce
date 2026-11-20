# Agent skills: Medusa-derived commerce patterns, checklists and test layers

Branch `docs/medusa-skill-patterns` (from `origin/dev`). Markdown only. No migration.

## What changed

- New skill `.claude/skills/koomerce-commerce-patterns/`: `SKILL.md` lists the eight patterns
  our code credits to Medusa (checkout step order, payment attempt keys, webhook dedupe,
  lock-then-recheck refunds, discount `registerUsage`, derived statuses, shipping options,
  return requests), each with where it lives, the rule to keep and the test that guards it.
  `reference.md` has the checklists (checkout, payments, refunds and returns, promotions,
  side effects, test layers) and the gaps found while checking.
- `koomerce-checkout-orders`: new "Money-path checklist". `koomerce-testing`: new "Which layer
  to write (commerce changes)". `koomerce-delivery-options`: one line pointing to pattern 7.
- `.claude/skills/README.md`: what the skill folders are, and how to install Medusa's own skills
  (`npx skills add medusajs/medusa-agent-skills`) outside the repo, for background only.
- Credit: new row in `THIRD_PARTY_NOTICES.md`, full licence texts in
  `.claude/skills/THIRD_PARTY_LICENSES.md`.

## Licences

- Used (MIT): OrcaQubits `agentic-commerce-skills-plugins` (10 Medusa skills, commit e7a890a),
  finsilabs `awesome-ecommerce-skills` `medusa-development` (commit fa38550). Found through
  `medusajs/medusa-community-skills` (MIT list).
- Not used: `medusajs/medusa-agent-skills` has no licence file (commit c5a56b4, 20 Nov 2026),
  so none of its text was adapted. If Medusa adds MIT later, it can be revisited.

## Gaps found (reported, not fixed)

Listed with file and function in `koomerce-commerce-patterns/reference.md`, "Known gaps":
Razorpay refunds ignore `refundKey`; refund webhook fallback flips a payment to `refunded`
with no refund row (order still reads paid); `startPaymentAttempt`'s compensating refund has
no key or catch; cart lines keep the add-to-cart price; per-customer discount caps skip
shoppers with no email; cancelled orders keep their discount use; a webhook's `failed` mark
rolls back with its transaction.

## Tests

- None; no code changed. Every path, function and test name cited was checked on `dev`.

## Left to do / for the owner to check

- Decide which gaps become issues (1 to 3 look like real bugs; 4 to 6 may be choices).
