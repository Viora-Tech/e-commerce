# Loyalty points v2: admin insight screens (members, activity, analytics, campaigns, emails)

Branch `feat/loyalty-v2-admin-insights` (from `feat/loyalty-v2` @ `702d5ab53`). Built beside the
program screens (`wt-count`) and the storefront widgets (`wt-qw`); this branch only adds the
screens below, its own copy file and a few small API pieces.

## Screens (`/apps/loyalty/...`)

- **Members** (`members`): table of Name, Status, Tier, Points, Lifetime points, Total spent,
  Joined. Search, Tier and Status filters, server sort (name, lifetime points, total spent,
  joined; Points is the live balance and is not sortable on the server), paging, all in the URL.
  A row opens the customer page. Header: Activity, and More actions → Import points, Export
  (CSV download), Reset all points (typed `RESET` dialog, never `confirm()`).
- **Import points** dialog: pick a CSV (email, points), choose set or add, **Check file** runs a
  server dry run (customers found, how many join, total points, unknown emails, rows that cannot
  be read), then Import shows changed, unchanged and skipped.
- **Activity** (`activity`, no tab; linked from Members): store-wide feed, 50 at a time, Show older.
- **Analytics** (`analytics`): the shared date range picker (no Today); Loyalty revenue chart
  (member revenue per store day, the shared `ChartCard`), then nine tiles: loyalty revenue,
  orders with rewards, redemption rate, member order value against others, active members, new
  members, points issued, redeemed and expired.
- **Campaigns** (`campaigns`): a 12-week strip (2 weeks back, Monday weeks in IST) with each
  campaign as a bar, overlaps stacked, a today line; then the list with Campaign, Status
  (scheduled, running, ended), Dates, Who, Bonus and a row menu (Edit, End now, Delete, each
  end or delete asks first). End now on a running campaign sets its end to now; on a scheduled
  one it switches it off.
- **Campaign editor** (`campaigns/[id]`, `campaigns/new`): name, start and end (store time),
  who (all members or picked tiers), bonus (multiplier like 2 or 1.5, or fixed points per
  order), and a live preview sentence with an example order.
- **Emails** (`emails`): the eight loyalty emails (points earned, reward redeemed, reward
  expiring 30 and 3 days, birthday, tier unlocked, points expiring 30 and 7 days) with an
  on/off switch each, sent and waiting counts, a "waiting for its design" line for the ones the
  worker cannot send yet, and a link to Settings → Notifications for the design.
- **Overview**: v1 tiles stay; a "More in Loyalty points" card links to Members, Analytics,
  Campaigns and Emails (`insight-cards.tsx`, one line added to `overview-page.tsx`).

## API and core added (smallest pieces)

- `loyalty.insights.getRevenue({ from, to })` → `{ days: { day, memberRevenuePaise,
  memberOrders }[], otherRevenuePaise, otherOrders }` (core `loyaltyRevenueSeries`,
  `packages/core/src/loyalty/insights.ts`): the chart and the non-member AOV. Orders count like
  `loyaltyAnalytics`.
- `loyalty.insights.previewImport({ csv })` → rows, points, errors, matched, newMembers,
  unknown emails (core `previewPointImport`): the import dry run. Both are reads by name for MCP
  (`get`/`preview`); action docs regenerated.
- Setting `emailsOff: string[]` (default `[]`) on `LoyaltySettingsSchema`, with
  `LOYALTY_EMAIL_KEYS`, `loyaltyEmailKey(template, data)` and `loyaltyEmailOn(settings, key)`
  in `settings.ts` (browser-safe). Keys are the template id, plus `:<days>` for the two expiry
  emails. `points_expiring` stays off while `reminderDays` is 0; switching it on from the
  Emails page sets `reminderDays` back to 14.
- Worker (`apps/worker/src/loyalty.ts`): a switched-off email is marked sent without sending,
  so it never goes out late. **Whoever adds the five new templates to the worker's send list
  must keep that check.**

## Shared files touched (one entry each)

`apps/admin/src/apps/registry.ts` (six loyalty pages), `packages/core/src/loyalty/app.ts`
(manifest pages: Members, Analytics, Campaigns, Emails tabs; Activity and `campaigns/[id]`
without tabs), `apps/admin/src/data/hi/index.ts`, `packages/api/src/routers/loyalty.ts`
(`insights`), `packages/core/src/loyalty/index.ts`, `overview-page.tsx` (one card).

## Tests

- `apps/admin/src/lib/loyalty-insights.test.ts` (range to IST instants, zero-filled days, AOV,
  CSV peek, members sort), `apps/admin/src/lib/loyalty-campaigns.test.ts` (status, multiplier,
  Monday weeks in IST, bar layout and lanes), `packages/core/src/loyalty/email-switches.test.ts`.
- Typecheck admin and core: nothing new (pre-existing `customize-overrides.tsx` error only).
  biome and `lint:components` clean on the new files (campaign editor is over the 300-line soft cap).
- Not run: the SQL of `loyaltyRevenueSeries` and `previewPointImport` against a database (no
  DB test written); check on localhost after `bun run db:migrate`.

## Gaps / for the owner

- New members **by source or placement**: the foundation stores no join source, so the tile
  shows the count only.
- Points is not a server sort (the members API sorts by joined, lifetime points, total spent,
  name).
- Activity has no filter by kind or customer (the API has none).
- Analytics has no comparison period.
