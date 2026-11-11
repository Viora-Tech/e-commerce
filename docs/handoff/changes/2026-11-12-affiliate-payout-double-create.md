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
