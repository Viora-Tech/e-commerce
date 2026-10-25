# Affiliates v1.1, PR 3a: fraud checks and blocklist

Design: `docs/superpowers/specs/2026-10-24-affiliates-parity-design.md` §4 fraud. The codes table and coupon rotation move to PR 4 (portal), where they are used.

- Pure rules in `packages/plugin-affiliates/src/fraud.ts` (client-safe entry `@commerce/plugin-affiliates/fraud`): coupon sites, `isCouponSpike` (24 h above `spikeMultiple` × the 28-day daily median, at least 5), blocklist normalising and masking, review reasons.
- `src/blocklist.ts`: the blocklist (encrypted value + HMAC index, so `rotate-secrets` recomputes it), `orderRisk` (blocked buyer, coupon from a coupon site without a click, coupon spike), `refreshReview` (a PAN or payee shared with another affiliate flags both; a blocked phone, PAN or payee), `clearReview`.
- Flag-and-hold: `creditOrder` stores a risky commission as `pending` with `flag` set; the approval sweep already skips flagged rows and Commissions → Clear/Reverse decides. Spike counts coupon-source commissions (clicked or not).
- Signup: a blocked email, domain or IP is refused (`AFFILIATE_BLOCKED`; the storefront answers as if sent); a blocked phone signs up but needs review.
- Payouts: new blocker `review` while `affiliate.review_reasons` is not empty.
- Settings `fraud { couponSites, spikeMultiple }`; admin Settings → Fraud checks and Blocklist cards; affiliate page Needs-review card ("Looks fine").
- API `affiliates.clearReview`, `affiliates.blocklist.{list,add,remove}`; MCP: blocklist add/remove are sensitive.
- Migration `0169_affiliate_fraud`: `affiliate_blocklist`, `affiliate.pan_index`, `payee_index`, `signup_ip_index`, `review_reasons`.
- Rotation: `refreshAffiliatePhoneIndexes` also recomputes PAN/payee and blocklist indexes; the signup IP index is cleared (the IP is not kept).
