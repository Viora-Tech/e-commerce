# Growth laid out like Shopify's (Attribution, Autopilot, Campaigns)

- Sidebar: Growth → Attribution, Autopilot, Campaigns. Links and Automations left the rail:
  `/growth/links` redirects to `/growth/campaigns?tab=links` (Tracking links tab); automations
  stay at `/growth/automations`, reached from "Marketing automations" on Campaigns and Recent
  campaigns and from ⌘K, until the Automations app (feat/automations) replaces them.
- `/growth` overview: Autopilot hero, Performance (sales attributed to marketing vs total store
  sales with a dotted previous-period line, sessions by traffic type, top four sources),
  recommendations, Autopilot strip, Recent campaigns (YTD sessions/sales). Dotted-underline
  labels with definitions (`components/growth/metric-label.tsx`).
- `/growth/attribution`: the former overview report (tiles, source/channel tables, outcomes,
  top campaigns) plus traffic types and the attribution-model note.
- `/growth/campaigns`: Campaigns | Tracking links tabs, YTD columns, "Campaigns from tracking
  links" (utm_campaign groups). API `marketing.campaignPerformance`
  (`services/campaign-performance.service.ts`).
- `marketing.overview` gained `trafficTypes` and `previousSeries` on `attributed_sales`
  (core `trafficType()` in `marketing/growth-report.ts`).
- `/growth/autopilot` v1: settings and proposals in `store.preferences.growthAutopilot` (no
  migration). Core rules `marketing/autopilot.ts` (goals, caps, festival calendar, planner);
  API `services/growth-autopilot.service.ts`, router `marketing.autopilot.*`. Plan writes draft
  email campaigns (AI copy via `@commerce/ai` campaign-writer under the product writer's
  allowance, template fallback); Approve creates the capped discount code and schedules the
  draft, or switches the abandoned-checkout automation on; Dismiss deletes the draft. Meta /
  Google ads shown as "coming with" their apps. The festival calendar (`FESTIVALS`) runs to
  Diwali 2027 and needs extending then.
- Merchant guide: growth overview rewritten, new attribution and autopilot pages.
