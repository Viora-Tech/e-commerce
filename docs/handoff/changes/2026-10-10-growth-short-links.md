# Growth → Links: saved short links with clicks, orders and revenue

Branch `feat/growth-links`. **Migration 0106_short_links** (tables `short_link`,
`short_link_click_day`; ends with `apply_store_rls()`).

- Storefront `/l/<slug>` (`app/-s/[storeId]/l/[slug]/route.ts`): counts the click per
  store-local day (not bots, link previews or HEAD; `isBotUserAgent`), redirects to the link's
  store path with its UTM tags (`shortLinkTarget`), sets `wc_lk` (link id, 10 min) for the
  page beacon and, with analytics consent, `wc_attr` with `linkId`. Unknown slug → home.
- Attribution gained `linkId` (core `Attribution`, db `MarketingAttribution`); the beacon reads
  `wc_lk`. A link with no tags and no referrer counts as `referral`, never `direct`, so it
  can't lose to an older touch.
- Orders/revenue per link = placed orders (not draft/cancelled) whose `attribution.linkId` is
  the link, same counting as the Growth overview (`shortLinkStats`).
- API `shortLinks.{list,totals,create,update,delete}`; admin `components/growth/links/*`
  (Figma list, empty state, New link dialog with the old UTM presets). `links-builder.tsx` gone.
- Pure rules `@commerce/core/marketing` `short-links.ts`; click counting in core
  `short-link-clicks.ts` (`followShortLink`). Tests: `short-links.test.ts` (core),
  `packages/api/test/short-links.test.ts` (DB), both run and passing.
