# Loyalty admin: Home, Campaigns, Members, Analytics, Placements in Essential Loyalty's layout

Branch `feat/loyalty-v2`. The owner approved matching Essential Loyalty (Shopify) for layout,
card order, fields and short labels. Longer help text is in our own words, and the visuals use
our admin design system. No migration and no API change. The Program, Referrals, rule and
reward pages and the shared setup bar (`setup-bar.tsx`) are in a separate change.

## App menu (`packages/core/src/loyalty/app.ts`)

The order is now Home (`overview`), Program (`''`), Campaigns, Members, Analytics, Placements,
then Emails. Activity is not in the menu; it opens from the Members header button. Routes did
not change: `/apps/loyalty` is still the Program page, so the app's own sidebar row and the
App Store "Open" button land on Program, not on Home.

## Screens

- **Home** (`overview-page.tsx`): the title is "Overview". On the right are status chips
  (`status-chips.tsx`): "3 App blocks" (the blocks the app offers), "App embed on/off" (the
  floating widget in the live theme) and "Loyalty live/paused". Below them is the setup bar with
  a "Review program" button, then our own figures, latest points and links. `setup-state.ts`
  reads settings, the earn rules (for the rate) and the live theme in one go for Home and
  Placements.
- **Campaigns** ("Bonus campaigns"): the timeline now shows even when there are no campaigns.
  Below it is a `ResourceTable` with an All / Running / Scheduled / Ended view and a name
  search. The columns are Campaign, Status, Dates, Who and Bonus, and each row keeps its menu.
  The empty text is "Schedule a double points weekend or a VIP-only reward."
- **Members**: the header buttons are Activity, then More actions (import, export, reset). An
  All / Active / Excluded view sits beside "Search customers", and the sort button is kept. The
  columns are Name, Status, Tier, Points, Lifetime points and Total spent. Joined is hidden by
  default and can be turned on from the columns menu. The empty state reads "No customers
  found" with one help line.
- **Analytics**: the header reads "Compared to the previous period" and has the date range.
  Every figure is also read for the same number of days just before the range.
  - Revenue: the "Loyalty revenue" card shows the total, a change chip and a daily line with
    the previous period dashed. Beside it, the "Loyalty ROI" card shows the multiple with
    Store credit issued, Points expired, Program cost and Program value. Under both are three
    tiles: Loyalty orders, Orders with rewards and Loyalty AOV (with others' AOV).
  - Engagement: Active members, New members and Redemption rate, each with a trend.
- **Placements** ("Onsite elements"): the setup bar with "Enable app embed" (opens Customize ›
  App embeds), then "Onsite content", a two-column grid of cards. The cards are Floating
  widget, Product page, Product card, Cart placement and Referral pop-up. Each has a status chip:
  Live or Disabled for embeds, Ready for blocks. Each also has a description, a "Customize"
  button and a small sketch of where it shows (`placement-art.tsx`).

## Left out of Essential's screens, and why

- Analytics: the loyalty vs non-member area chart. The API has non-member revenue only as a
  total, not per day, so the chart compares with the previous period instead.
- Analytics: the "Discounts cost" ROI row. The value of reward codes used in a range is not
  stored per range. Cost is the store credit given (₹1 a point) minus points that expired.
- Analytics: the daily active members chart. There is only a range total, so it is a tile.
- Home: the app block count is how many blocks the app offers, not how many are placed in
  templates. Templates are not scanned.
- Placements: the illustration inside the setup bar. The shared bar has no slot for one.
- Members: "Submissions". We have no submissions.
- All upsell, plan locks, Billing and chat blocks.
