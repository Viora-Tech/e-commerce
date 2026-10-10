# Growth overview: what marketing earned (Figma outcomes summary)

Branch `feat/growth-outcomes`. No migration.

- `growth-outcomes.service.ts` (`growthOutcomes`, part of `marketing.overview` as `outcomes`):
  revenue and orders from our campaigns (`attribution.campaignId`), automations
  (`automationId`), discounts (`order.discount_id`, grouped by code/label) and short links
  (`linkId`), each with its top performer; "earned" counts an order once; previous period for
  the change; messages sent by channel; subscribers (accepts marketing) and new this week.
  Counted orders exclude draft and cancelled, like the rest of Growth. Test:
  `packages/api/test/growth-outcomes.test.ts` (run, passing).
- Admin: header summary "Campaigns, automations, discounts and links brought in ₹X …", Links and
  New campaign buttons, the Figma stat cards (Sales from growth, Messages sent, Automation
  orders, Subscribers) replacing the old KPI tiles, and `outcomes-card.tsx`. The chart, sources
  and top campaigns below are unchanged. `growth-kpi-tile.tsx` removed.
