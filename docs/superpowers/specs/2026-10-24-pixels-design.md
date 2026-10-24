# Pixels app (like "Parkour: Facebook Pixel & Feed"): design

Date: 2026-10-24. Status: approved, building (owner answers in §10). Read against `docs/next-apps-specs` at `dbe50859`.

## 1. Intent and decisions

Meta ads are how Indian D2C brands sell. The browser pixel on its own misses many purchases (iOS 14, Safari ITP, ad blockers), so
Shopify stores add a free app like Parkour that sends each event from the browser **and** the server (Conversions API, CAPI).
Today Koomerce has one Meta pixel id per store, and it sends **PageView only** (`apps/storefront/src/components/analytics/tracking-tags.tsx`).

Decided by the owner (2026-10-24):
- **Pixels** is a separate built-in app, installed from the App Store site like other apps. Meta comes first.
- v1 is the Meta Pixel plus CAPI with a **CAPI token the merchant pastes in**, so no Meta App Review. **Several pixels per store.**
- Browser events are PageView, ViewContent, AddToCart, InitiateCheckout and Purchase. Each shares an `event_id` with its server copy, so Meta counts it once.
- The server sender runs on the outbox plus a BullMQ worker with retries. Customer details are hashed with SHA-256 after normalising (Indian phone rules).
  `_fbp`/`_fbc` are first-party cookies set by our own endpoint. Everything waits for consent (DPDP).
- Each pixel picks when Purchase is sent: when the order is placed, paid or delivered. A warning explains Meta's 7-day limit on server events.
- The admin page has an add dialog, a test event code, **Send test event** and an event log (kept 30 days, no raw PII).
  The token is stored encrypted. An expired token puts the pixel in **Error** and alerts the owner.

**Later phases, not v1:** TikTok, GA4 Measurement Protocol and Google Ads browser conversions (v1.1, 4–5 days). One-click Meta through
`ads_management` App Review, Event Match Quality (EMQ) scores, custom events from CSS-selector clicks, Snapchat and Pinterest (v2, 6–8 days plus the review wait).
Google Ads server conversions through the Data Manager API (v3, 5–7 days plus Google verification). The feed half of Parkour already exists in Sales channels.

**Anti-goals:** no event without marketing consent. No raw PII in Redis, the log or app logs. No Purchase counted twice. No test (PR #608)
or imported orders. No slower storefront: the collector only adds jobs to the queue. The token can never be read back, including over MCP.

**Build vs adopt:** the radar (`docs/open-source-radar.md`) has nothing for pixels. CAPI is a single JSON POST, so we use `fetch` rather than
Meta's business SDK. Build it ourselves; no adapted code needs crediting.

## 2. Reused code (verified)

- Consent: `wc_consent` and `allowedTags()` in `packages/core/src/online-store/consent.ts` already tie `metaPixel` to **marketing**.
  The banner, `apps/storefront/src/components/privacy/consent-manager.tsx`, renders `TrackingTags`.
- Old field: `TrackingSchema.metaPixel` in `packages/core/src/online-store/preferences.ts`, edited in `apps/admin/src/components/preferences/preferences-form.tsx`.
- Cookies and the twin route: `apps/storefront/src/app/api/beacon/route.ts`, `lib/visitor-cookie.ts`, `lib/cart-cookie.ts`. Click ids are booleans only (`packages/core/src/marketing/attribution.ts`).
- Outbox: `order.placed` (`packages/core/src/order/place-order.ts:648`), `order.paid` (`order/recompute.ts:176`) and
  `order.delivered` (`shipping/shipments.ts:380`). Relay `dispatchRow` is in `packages/core/src/outbox/relay.ts`.
- Queues: `packages/queue/src/index.ts` (`*_QUEUE`, `QUEUE_LIMITS`, `KEEP_FINISHED`) and `apps/worker/src/`. The prune job follows `automations-prune.ts`.
- Built-in app shape: `packages/core/src/automations/app.ts` (`definePlugin`, `kind: 'builtin'`), `commerce.config.ts`,
  `catalogue.generated.ts`, `apps/admin/src/apps/registry.ts` (`ADMIN_APPS`) and `apps/admin/src/app/(admin)/apps/[pluginId]/[[...path]]/page.tsx`.
- Helpers: `encryptSecret`/`decryptSecret` (`packages/core/src/secrets.ts`), `clientIp` (`rate-limit/ip.ts`),
  `normalisePhone` (`marketing/audience.ts`: 10 digits get `91`, a leading 0 is dropped) and `META_GRAPH_VERSION = 'v26.0'` (`sales-channels/providers.ts`).
- App status and alerts: `recordAppError`/`recordAppActivity` (`packages/core/src/apps/installation.ts`), and the owner email in `automations/engine/owner-alerts.ts`.
- Plugin hooks have no storefront script slot and no `order.placed`. So, like Automations, the engine lives in core (`packages/core/src/pixels/`).

## 3. Data model: migration `0160_pixels.sql`, `packages/db/src/pixel-schema.ts`, forced RLS

0160 is the next free number (the latest on this branch and `origin/dev` is `0159_profit.sql`). Renumber if another spec lands first.

- **`pixel_connection`**: id, store_id, `platform` (`'meta'`), `pixel_id` (10–20 digits), `name`, `token_enc` (null = browser only),
  `token_hint` (last 4), `test_event_code`, `events` text[] (all five by default), `purchase_trigger` (`placed|paid|delivered`, default placed),
  `status` (`active|paused|errored`), `last_error`, `last_error_at`, `last_sent_at`, created_by, timestamps. It is unique on `(store_id, platform, pixel_id)`.
  At most 10 per store (builder's call).
- **`pixel_event_log`**: id, store_id, connection_id (cascade), `event_id`, `event_name`, `origin` (`storefront|order|test`),
  `status` (`queued|sent|failed|skipped`), `skip_reason` (`no_consent|test_order|imported|too_old|paused|errored`), `http_status`,
  `fbtrace_id`, `error` (Meta's message, at most 500 chars), `attempts`, `matched` jsonb (**booleans only**: em, ph, fn, ln, ct, st, zp, external_id, fbp, fbc, ip, ua),
  `value_paise`, `order_id`, created_at, sent_at. It is unique on `(connection_id, event_name, event_id, origin)`, so a retry updates its own row. Indexes: `(store_id, created_at desc)`.
- **`pixel_event_day`**: daily counts (sent/failed/skipped) per store, pixel, IST day, event and origin. Successful PageViews are only
  counted here, never written to the log row by row (builder's call: it keeps the log small).
- **`cart.tracking` / `order.tracking`** jsonb: `{ fbp, fbc, fbclid, ip, ua, landingUrl, consent: { marketing, analytics, version, at } }`.
  The collector writes it on the cart, and `place-order.ts` copies it next to `attribution`.
- The migration also turns each store's existing `preferences.tracking.metaPixel` into a Pixels install plus a browser-only row (Q4).
- Retention: a daily `{pixels}-prune` deletes log and day rows older than 30 days, and clears `order.tracking.ip/ua` after 30 days.

## 4. Event flow

**Browser**
```
block/page ─ CustomEvent 'commerce:track' {name,data} ─▶ listener (marketing consent only)
   ├─▶ fbq('trackSingle', pixelId, name, data, {eventID})   for each pixel with that event switched on
   └─▶ sendBeacon('/api/px', {name, eventId, url, ids})
```
- `apps/storefront/src/lib/pixels/track.ts` holds the logic. Blocks only send a DOM event; `product-buy-buttons.tsx` sends one after `onAddToCart` (builder's call).
- Where events fire: PageView from the loader, ViewContent on the product page, InitiateCheckout when checkout mounts, Purchase on `checkout/thank-you/[number]`.
- Event ids: `ord_<orderId>`, `ic_<cartId>`, `atc_<cartLineId>_<n>`, and a UUID for PageView and ViewContent.
- **The browser sends Purchase only for pixels set to "placed".** A paid or delivered server Purchase can arrive after Meta's 48 h dedup window and would count twice.
- `tracking-tags.tsx` takes `pixels: {id, events}[]` and runs `init` for each. The pixel ids come from the cached store data; the token never reaches the browser.

**Collector** `apps/storefront/src/app/api/px/route.ts`
```
POST ─▶ same origin, store from host ─▶ marketing consent? ─no─▶ 204, nothing kept
   ├─▶ read or mint _fbp (fb.1.<ms>.<rand>) and _fbc (fb.1.<ms>.<fbclid>): 390-day first-party cookies
   ├─▶ stamp cart.tracking
   └─▶ queue a {pixels}-send job for each active pixel that has a token and the event on ─▶ 204
```
- The body is capped at 4 KB, it is rate-limited, and only the five event names are accepted. Values and contents come from the cart or catalogue, never from the browser.
- Job data holds ids, fbp/fbc, IP and UA only. **Email, phone and address are loaded from Postgres when the worker sends.**

**Server Purchase**
```
order.placed / paid / delivered ─tx─▶ outbox ─dispatchRow (only if Pixels is installed)─▶ {pixels}-order  jobId px-order-<rowId>
   ▶ skip and log: isTest, imported, no order.tracking, no marketing consent, placed > 7 days ago (too_old)
   ▶ for each pixel whose purchase_trigger matches: {pixels}-send  jobId <connId>:Purchase:ord_<orderId>
```
`event_time` is the time the order was placed (builder's call). The data sent is value in INR, `content_ids`/`contents`, `num_items`, and `order_id` set to the order number.

## 5. Worker and sender (`apps/worker/src/pixels.ts`)

- Queues `{pixels}-order`, `{pixels}-send` and `{pixels}-prune`. `QUEUE_LIMITS` gets `pixelsOrder {5, 2}` and `pixelsSend {10, 3}` (builder's call).
- `packages/core/src/pixels/meta.ts` POSTs to `graph.facebook.com/${META_GRAPH_VERSION}/<pixelId>/events` with `action_source: 'website'`,
  `event_source_url`, the hashed `user_data` plus unhashed IP, UA, fbp and fbc, and `test_event_code` when set. One event per call in v1.
- `packages/core/src/pixels/hash.ts`: `em` is trimmed and lowercased. `ph` uses `normalisePhone`. `fn`/`ln` are lowercased with punctuation removed (UTF-8 kept).
  `ct` is lowercased with no spaces. `st` is the Indian state code (`mh`). `zp` is the 6-digit PIN, `country` is `in`, and `external_id` is the hashed customer or visitor id.
- Retries: `attempts: 6` with exponential backoff from 30 s. 429, 5xx and Meta codes 4/17/32/613 are retried. Other 4xx errors fail and are logged.
- Graph error 190/102 (OAuth): the pixel becomes `errored` and the app is marked with `recordAppError`. A `pixel.connection_failed` outbox row sends one owner email,
  sending stops, and later jobs are skipped as `errored`. Each success updates the log, `pixel_event_day`, `last_sent_at` and `recordAppActivity`.

## 6. App, router and permissions

- The manifest is `packages/core/src/pixels/app.ts` (`id: 'pixels'`, builtin, category marketing), exported as `@commerce/core/pixels-app` and added to `commerce.config.ts`.
  After that, regenerate the catalogue. It reads orders, customers and products. Its pages are `''` (Pixels) and `events` (Event log). It is not pre-installed, and it is free unless Q1 decides otherwise.
- `packages/api/src/routers/pixels.ts` checks the app is installed, the same way `affiliates.ts` does. Needs `marketing.write`: `create`, `update`, `setToken`, `clearToken`, `setStatus`, `remove`, `sendTest`.
  Needs `marketing.read`: `list`, `get`, `log.list`, `log.get`, `stats`. Responses carry `tokenHint` only.
- `sendTest` runs at once with a 10 s timeout and sends a PageView with the test code. Saving a token checks it with `GET /<pixelId>?fields=id,name`.
- MCP: reads run straight away. Create, update and pause follow the approval switch. Remove is sensitive. **`setToken`/`clearToken` are left out of MCP** (the owner's rule).
- The token is stored with `encryptSecret`, the same way as `sales-channels/connect.ts`, and is decrypted only in the worker and `sendTest`.

## 7. Admin screens (dialogs and full pages only, no right drawers)

Copy lives in `apps/admin/src/data/pixels.ts`, with the Hindi overlay in `data/hi/pixels.ts`. Components go in `apps/admin/src/components/apps/pixels/`.

- **Pixels page**: an **Add pixel** button and a 7-day `StatStrip` (events sent, purchases, failed, skipped for no consent), then one `DataCard` per pixel.
  Each card shows the name, the id with a `CopyButton`, a `LiveChip` (Browser + server / Browser only / Paused / Error), "Last event", five event
  checkboxes, the Purchase select, and the test event code. Choosing paid or delivered shows a warning: "Meta only accepts purchases sent within 7 days of the order."
  An errored pixel shows a banner, "Meta stopped accepting this token. Paste a new one.", with **Replace token**. The footer buttons sit on the right:
  **Send test event**, **Edit**, and a `…` menu (Pause, Remove; Remove asks in a confirm dialog).
  When there are no pixels, the page says: "Send your sales to Meta, even when browsers block the pixel."
- **Add / Edit pixel dialog**: platform (Meta; TikTok and Google shown disabled), name, pixel ID, CAPI token (password field, "Optional.
  Without it only the browser pixel runs."), test event code. Save checks the token and shows the pixel's name from Meta.
- **Event log page**: `KitListPage` + `ResourceTable` with tabs All / Sent / Failed / Skipped. Filters: pixel, event, origin, date. Columns: time,
  event, pixel, origin, status, matched ("Email · Phone · fbp"), value, order. Clicking a row opens a dialog with the event id, Meta's response,
  fbtrace id, attempts and the matched checklist.
- Online store preferences: the Meta pixel field becomes a link that says "Moved to the Pixels app". The merchant guide is `apps/docs/content/merchant-guide/apps/pixels.mdx`.

## 8. Testing and rollout

- Unit tests: hashing (phone variants, Hindi names, state codes), event ids, the Meta payload snapshot, the error classifier, trigger matching with the 7-day skip, the cookie format and the consent gate.
- Integration tests (db): the 0160 move and RLS, relay queueing only when installed, idempotent jobIds, the skip reasons, errored status plus one alert, the `/api/px` route, prune, router guards (no token in any response).
- End to end: there is no Playwright in the repo. On vioratech.in (`dev`), in Chrome, use a test pixel and code, and check Events Manager → Test events.
  Each event should show browser and server and "Deduplicated". Declining consent should send nothing. A revoked token should show Error and send the email.
- Rollout: merge to `dev` with the app hidden from the catalogue. Run our own pixel for a week and compare Meta's purchases with our orders. Then list the app and release.

## 9. PRs (each into `dev`, each with a `docs/handoff/changes/` note and docs)

| # | PR | Contents | Size |
| --- | --- | --- | --- |
| 1 | Data | Migration 0160, `pixel-schema.ts`, `tracking` copied in `place-order.ts`, RLS tests | S |
| 2 | Core | hash, event ids, Meta mapper and client, error classifier, consent gate, unit tests | S |
| 3 | Server | queues, relay consumer, worker (order/send/prune), owner alert, router, MCP classes | M |
| 4 | Storefront | multi-pixel `tracking-tags.tsx`, `lib/pixels/track.ts`, `commerce:track` events, `/api/px` with first-party cookies | M |
| 5 | Admin | manifest and catalogue, Pixels page, dialogs, test event, event log, copy in English and Hindi, preferences link, guide | M |

That is about 8–10 days. PRs 2 and 4 come after 1, 3 after 2, and 5 after 3.

## 10. Questions for the owner (only ones that change the build)

**Answered 2026-10-24:** (1) free on every plan; (2) yes, add the fourth option, stored as
`purchase_trigger = 'paid_or_delivered'`; (3) yes, name "advertising partners such as Meta" and bump
the banner version; (4) yes, 0160 installs Pixels and moves the id. The old preferences field is left
in place (not cleared) so a `dev` → `main` release between PRs never drops a live pixel; the storefront
stops reading it in PR 4.

1. **Price.** Recommended: free on every plan, as Parkour is. → `APP_PRICING`.
2. **COD.** Recommended: a fourth Purchase option, "Prepaid when paid, COD when delivered". → `purchase_trigger`, the dialog.
3. **Consent wording.** Sending hashed email and phone to Meta: recommended to name "advertising partners such as Meta" in the marketing
   line and bump the banner version. That asks every returning shopper again. → `consent.ts`, PR 4.
4. **Existing pixel ids.** Recommended: migration 0160 installs Pixels and moves the id, so nothing changes for shoppers. The alternative is that the old field keeps
   working until the merchant installs the app, and the storefront reads both. → PR 1.
