# Cookieless session counting (#1436)

Sessions ran about 8% below Shopify because only shoppers who said yes to analytics were counted.

- `/api/beacon` without analytics consent now counts the visit cookieless
  (`apps/storefront/src/lib/anonymous-visit.ts`): id = `anon:` + sha256(SETTINGS_SECRET, IST day,
  store, IP from `cf-connecting-ip`, user agent), first 32 hex. The day is in the hash, so ids
  change daily and cannot be joined across days. No cookie is set or read.
- A visit is open while Redis key `{anon-ses}:<store>:<id>` lives (30 min, extended on each page
  view, a tagged landing starts a new one). A new visit writes one `marketing_session` row with
  its source (UTM / referrer) and adds the id to the live and daily visitor counts.
- A yes mid-visit sends the beacon again with cookies; if the cookieless visit is still open, no
  second `marketing_session` row is written (cart attribution still set).
- Discovery events, browse abandonment and cart attribution still need a yes.
- Client: `VisitBeacon` is always mounted (prop `consented` re-sends on a yes); the plain-HTML
  island script sends one `anon-visit` beacon until a yes.
- Effects to know: Sessions and fair-use visit counts rise; conversion rate falls to match.
  Live/daily visitors can count a shopper twice on the day they say yes (cookieless id + cookie id).
  No IP → no count (never lumps shoppers together).
- Tests: `anonymous-visit.test.ts`, `consent-manager.test.ts` (beacon now always present).
