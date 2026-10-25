# Affiliates v1.1, PR 2: Share and earn

Design: `docs/superpowers/specs/2026-10-24-affiliates-parity-design.md` §4 auto-enrol. Owner questions 1 and 2 taken as recommended: invite only (one tap, never automatic) and cash commission.

- Store setting `autoEnrol { mode: 'off' | 'invite', programId, minOrderPaise }` (Affiliates → Settings → Share and earn, `share-and-earn-card.tsx`).
- `packages/plugin-affiliates/src/enrol.ts`: signed invite (`affiliate-enrol` token purpose, 90 days), `enrolOffer` (installed, open, invite on, real order with a customer, not test/cancelled, above the minimum), `enrolFromOrder` (the order's customer becomes an approved affiliate in the chosen program, `source = 'enrolled'`; a second tap returns them), and the plugin's `orderLinks` ("Share and earn 10% on every sale" on the thank-you page, order page and order emails).
- Storefront `/affiliate/join?t=`: nothing happens until the buyer taps **Get my link** (email link scanners are safe), then shows their link and code.
- Migration `0168_affiliate_source`: `affiliate.source` (`applied` | `added` | `enrolled`); merchant-added affiliates are `added`.
- Merchant guide: "Share and earn" section.
