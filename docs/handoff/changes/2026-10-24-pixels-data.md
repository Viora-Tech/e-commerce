# Pixels app, PR 1 of 5: data

First PR of the Pixels app (Meta Pixel + Conversions API, like Parkour). Design:
`docs/superpowers/specs/2026-10-24-pixels-design.md` (owner answers in §10).

- Migration `0160_pixels.sql`, schema `packages/db/src/pixel-schema.ts`, forced RLS:
  - `pixel_connection`: one pixel per row, several per store, unique on `(store, platform, pixel_id)`.
    `token_enc` (null = browser only) and `token_hint`; `purchase_trigger` is
    `placed | paid | delivered | paid_or_delivered` (the last: prepaid when paid, COD when delivered).
  - `pixel_event_log` (30 days, booleans-only `matched`, unique per connection/event/event id/origin)
    and `pixel_event_day` (daily counts, IST day).
  - `cart.tracking` / `order.tracking` jsonb (`PixelTracking`: fbp, fbc, fbclid, ip, ua, landing URL,
    consent). `place-order.ts` copies the cart's onto the order next to `attribution`.
  - `stores_with_old_pixel_data()` (SECURITY DEFINER, `storesWithOldPixelData`) for the PR 3 prune.
  - Move: each store with `preferences.tracking.metaPixel` gets `pixels` in `store.apps.installed`, an
    `app_installation` row and a browser-only pixel. The old field is **not cleared**; the storefront
    stops reading it in PR 4.
- Tests: `packages/db/test/pixels-migration.test.ts` (move, idempotence, RLS, checks, prune list) and
  a `place-order.test.ts` case for the tracking copy.
- Nothing reads the tables yet. Next: PR 2 (core: hashing, event ids, Meta mapper and client).
