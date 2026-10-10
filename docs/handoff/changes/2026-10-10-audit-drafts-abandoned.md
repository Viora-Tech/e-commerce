# Audit 1: Draft orders tabs, Abandoned checkouts list

Figma-vs-localhost audit of Orders screens.

- Draft orders: status tabs (All drafts / Open / Invoice sent) with counts; `orders.listDrafts` takes an optional `status`; intro copy matches the frame.
- Abandoned checkouts: summary line, tabs (All / Not recovered / Reminder sent / Recovered) with 30-day counts, search, "Cart" column (first product + "+ N more"), "Left" and "Recovery" columns, Recovered/Reminders-sent tiles filter the list, "Send reminders" header button (sends to the visible unreminded carts), per-row send moved into the row menu.
- Additive backend: `listAbandoned` takes `status` + `search` and returns `firstTitle`; `abandonedStats` takes `days` and returns `notRecovered` + `remindersSent`.
- Not done: Export button and the abandoned checkout detail page (no detail route exists yet); tile trend deltas (no previous-period data).
