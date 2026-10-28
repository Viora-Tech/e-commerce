# Staff accounts are enforced on invites

Branch `fix/plan-limits`. The plan's staff accounts (1 / 3 / 10 / 25, owner included, set on
28 Oct) were only shown on Plan & billing. Now `staff.invite` refuses an invite once active
members plus pending invites reach the plan's number (`FORBIDDEN`, `data.reason: 'staff_limit'`),
and the invite dialog says so in English and Hindi.

- Count: `staffSeats` in `packages/core/src/billing/staff-seats.ts`. A pending invite holds a
  seat; cancelling frees it; resending never needs a new one. A trial counts as Growth.
- Existing members are never removed, and accepting an invite already sent always works, so a
  store that moves down a plan keeps its team and just can't invite more.
- Test: `packages/api/test/invitations.test.ts` ("refuses an invite past the plan's staff accounts").
- Merchant guide: Settings → Staff, "How many people".
