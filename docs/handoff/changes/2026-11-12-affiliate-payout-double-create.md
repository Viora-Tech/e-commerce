# Affiliates: "Create payouts" twice at once makes one payout (12 Nov 2026)

Issue #1591. Found in the Phase 1b group 2 apps audit
(`docs/audits/2026-11-12-apps-group-2.md`).

- `createPayouts` (`packages/plugin-affiliates/src/payouts.ts`) read the candidates, inserted a
  payout with their totals, then assigned the commissions. Two requests at once each inserted a
  payout; the second assigned nothing but kept the full amount, so the bank file paid twice.
- Now each payout claims its commissions first (`update … returning`; row locks give each
  commission to one payout), and its gross, TDS, clawback, GST and net are worked out from what
  it claimed. A payout that claimed nothing is deleted and not returned. This also keeps a
  commission approved in between from joining a payout without being counted.
- Test: `packages/plugin-affiliates/test/payout-race.test.ts`.

## Referral cookie waits for a yes to marketing (owner, 12 Nov 2026)

The owner's answer to the audit's open question 1: the `wc_ref` affiliate referral cookie is a
marketing cookie now, no longer set whatever the banner says.

- `referralClick` (`apps/storefront/src/lib/referral-click.ts`) takes `marketing`; without it
  `cookie` is null. The proxy (`lib/referral-landing.ts`) reads the consent cookie
  (`marketingAllowed` in `lib/consent-cookie.ts`). The click is still counted (a daily total per
  affiliate, nothing about the shopper).
- A yes later in the same visit: `ConsentManager` calls `usePendingReferral`
  (`hooks/use-pending-referral.ts`). Before the yes it keeps the landing's `?ref=` and time in
  the tab's session storage (`lib/referral-pending.ts`); on the yes it posts it once to the new
  `/api/referral` route, which checks the consent cookie and the origin, rate-limits per IP, and
  sets the cookie dated at the click (`referralCookieFromPending`: a valid code, not in the
  future, at most a day old), never over a newer referral.
- Discount codes earn with or without cookies, as before.
- Copy: the banner's Necessary text no longer mentions the referral, the Marketing text does
  (`apps/storefront/src/data/online-store.ts`); admin "Link counts for" help (English and Hindi);
  merchant guide `apps/affiliates.mdx`; developer docs `customer-privacy.mdx`.
- Tests: `apps/storefront/src/lib/referral-click.test.ts` (no cookie without marketing, pending
  landing to cookie), `apps/storefront/src/lib/referral-pending.test.ts`.
