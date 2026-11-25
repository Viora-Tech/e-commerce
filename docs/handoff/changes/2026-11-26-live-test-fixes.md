# Fixes from the owner's live test of the 25 Nov release (10 items)

Branch `fix/nov25-live-test` (from `origin/dev`). Migration `0271_gst_stale_queue_drafts`
(data only, journal `when` 1796040000000).

## What changed

1. **App install store picker** runs the page's full width; store names wrap, never cut
   (`apps/admin/src/components/apps/install/install-store-picker.tsx`).
2. **Theme editor → App embeds settings**: each setting is labelled once (the panel's own
   grey label is gone; `FieldFrame` labels), labels wrap, and the dynamic-source button sits
   beside the label through `FieldLabelAction` (`apps/admin/src/lib/field-label-action.ts`,
   `field-frame.tsx`, `dynamic-source-field.tsx`). Colour settings (`metadata.colour` on the
   field) use the theme's `SwatchRow`, with Clear for an optional one
   (`app-embed-field.tsx`); `metadata.advanced` folds a setting under "Advanced"
   (`apps-panel.tsx`). Loyalty's embed schema uses both and shorter labels
   (`packages/core/src/loyalty/storefront-blocks.tsx`).
3. **Theme scripts switch** moved from the canvas corner (it covered the Rewards launcher) into
   the top bar beside zoom, renamed "Interactive preview" with a tooltip
   (`theme-scripts-toggle.tsx`, `lib/theme-scripts-view.ts`, copy in `data/theme-editor-apps.ts` + hi).
4. **Loyalty**
   - a. A new install (`seedLoyaltyOnInstall`, `packages/core/src/loyalty/install.ts`, called from
     `installStoreApp`) saves the agreed defaults with referrals on (member 100 points, friend
     10% off), makes the earning rules, and adds "₹50 off your order" (50 points) and "Free
     shipping" (75 points), both on orders over ₹499, when the store has no rewards. Points are
     ₹1 each, so ₹50 off costs 50. A reinstall keeps the store's own settings and rewards.
   - b. Widget redone toward Essential Loyalty: gradient header from the merchant colour
     (`--kl-hero`) with store badge, cards overlapping it, tinted icon tiles, Points rows with
     counts, Refer a friend with They get / You get tiles (shown to visitors too:
     `publicLoyaltyProgram` now sends `referrerReward`), link and Copy on their own row, a
     member balance card and "Your rewards". The header no longer shrinks under the cards
     (it squeezed in the scrolling panel), and accent buttons use `!` because imported themes
     restyle `button`/`a`. Shared class strings live in `loyalty-styles.ts`; both apps'
     `globals.css` now `@source` `packages/blocks/src/**/*-styles.ts`.
   - The real Essential widget could not be viewed: the Shopify test store's theme has the
     Essential embed switched off (not changed), so the layout follows the spec notes.
5. **App pages width**: the blanket `md:pr-12` and `mt-4` are gone. `AppShellActions`
   (`apps/admin/src/components/apps/app-shell-actions.tsx`) measures the floating pill + "…" and
   pads only the page's first heading (`data-page-header` on PageHeader, `data-section-head` on
   SectionHead); a page whose first heading is not at the top starts below the actions. Tables,
   stat cards and timelines now share the header's right edge (same as Orders). The status pill
   is no longer cut ("GSTIN … · numbering 2026-27").
6. **Drafts list dims opened drafts**, same style as shipped orders (`rowMuted`). Reuses the
   per-member per-draft `draft_seen` table: `seenDraftIds` (`drafts-seen.service.ts`),
   `listStoreDrafts` returns `seen`; staff drafts are marked seen on open too (they never count
   in the badge). No migration.
7. **GST Queue count and stale rows**
   - Badge and list share `queueConditions` (`queue-list.ts`); every queue change forgets the
     cached app bar after commit (`forgetAppBar`, `queueChanged` in the gst routers); order
     actions and the order card refresh the router.
   - Root cause of "Ready" rows for invoiced orders: an order invoiced before it had parcels
     (one invoice with no parcel) was queued again per parcel when it shipped. Now the Queue,
     its count and `issueDrafts` ignore/refuse a draft whose goods an issued invoice already
     bills (`alreadyInvoicedDraft`), `enqueueOrderParcels` skips such a parcel, and migration
     0271 deletes those stale drafts (no numbers; idempotent; same rule).
   - The row button "Already invoiced" (an action, not a status) now reads "Mark invoiced".
8. **Loyalty panel closes on a press outside** the widget (and Escape), `loyalty-panel.tsx`.
9. **Checkout summary card** no longer scrolls inside itself; it is sticky only while the whole
   card fits the screen (`checkout-summary-aside.tsx`). The items list keeps its own cap.
10. **Points in checkout** (`apps/storefront/src/components/checkout/checkout-loyalty.tsx`, under
    store credit): "You'll earn N points with this order" for a member, a sign-in line with the
    points for a visitor, and the rewards that fit the cart with Apply (claims the reward, then
    puts its code on the cart through `/api/loyalty/apply` = the normal discount path; no new
    pricing). Hidden unless the app is installed and the program is live.

## Tests

- Added: `packages/plugin-gst-invoices/test/queue-count.test.ts` (badge = list, cancelled,
  other store, issued, stale draft not listed / not issued, no re-queue),
  `packages/api/test/drafts-seen.test.ts`, `packages/core/src/loyalty/install.test.ts`, a case in
  `packages/api/test/app-bar-cache.test.ts`, two in `packages/blocks/test/loyalty-widget.test.ts`.
- Run here and passing: those, plus gst `queue-status`, `parcels`, `record-external`, `issue`;
  api `apps`, `order-drafts`; core `v2-referrals`; blocks `app-blocks`; admin customize
  `inspector-fields`, `section-inspector`, `canvas-app-embeds`, `image-field`,
  `customize-top-bar`. Typecheck clean: admin, storefront, api, core, blocks, plugin-gst-invoices.

## Left to do / for the owner to check

- Checkout reward Apply (10b) was not clicked through locally (the test member had 0 points);
  the earn line and sign-in line were checked. The rewards list reads the shopper's cart from
  `/api/loyalty/state?cart=1`; a Buy it now checkout cart may differ from it.
- Live: migration 0271 runs on deploy (worker). Check the Queue on live afterwards (#2475,
  #2481, #2491 should be gone if their goods were invoiced).
- Local test data made while checking: customer `widget-test-member@example.com` with a session
  in the local Waimers store, and Loyalty was uninstalled and installed again there.
- `bun run lint:components` reports errors elsewhere already on dev (e.g.
  `delivery-options/rule-order-card.tsx`); none in the files changed here.
