# Back in stock rebuilt in Essential's layout (26 Nov 2026)

Branch `feat/back-in-stock-essential`. The Back in stock app now follows the back-in-stock half of
Essential's "Essent Preorder Back in Stock" app (captured on the test store; notes and shots in the
session scratchpad `essential-apps/back-in-stock.md`), in our shadcn style and our own words. WhatsApp,
the free quota, restock-tag import and the Signups list are kept. **No migration**: every new
setting lives in the existing `back_in_stock_settings.settings` JSON with a default that keeps
today's behaviour, except the two noted under "Storefront".

## Admin (`apps/admin/src/components/apps/back-in-stock/`)

Nav is now **Overview · Campaign · Signups** (the old `settings` page is gone; `settings-editor`
and `settings-section` deleted).

- **Overview** (`overview-page.tsx`, `demand-table.tsx`, `export-signups.ts`) — Essential's Back in
  stock page + Analytics tab: header actions *Import signups* (restock tags), *Export signups* (CSV
  with full contacts, new `backInStock.signups.export`, manage permission) and *Edit campaign*;
  an amber "campaign is off" banner with Turn on; this month's free sending with a bar; the
  campaign row with a Live/Off chip; **Analytics** with the date-range picker and four figures
  against the period before (*Waiting for restock*, *New sign-ups*, *Notified*, *Orders from
  alerts* with sales); the per-product list with tabs *All · New sign-ups · Waiting 30+ days* and a
  search; *General settings* (where the button shows, sender email → Settings › Notifications).
- **Campaign** (`campaign-page.tsx` + one file per tab, `campaign-preview.tsx`) — Essential's
  campaign editor: title with Live/Off chip, Turn off/on, Save; tabs with a "Continue to …" button
  and a live shopper preview on the right:
  - *Notification settings*: title, when alerts go out (as soon as the variant is buyable),
    collect email / WhatsApp number, channels, alerts per minute.
  - *Button*: text (empty = "Notify me when available"), Style Default (theme's Add to cart) or
    Custom (colour, text colour, corners as named sizes mapped to rem), where the button shows.
  - *Pop up*: pop-up or inline; header, description with `{product}`, disclaimer, email
    placeholder and error, button text, newsletter checkbox (+ text, pre-ticked), success header
    and message.
  - *Email*: Edit links to the store email editor for `back_in_stock_alert` and
    `back_in_stock_confirm`; the **double opt-in** switch (Essential's "GDPR compliance").
  - *Products*: all products / chosen collections / chosen products (the Discounts Browse
    dialog); a note that pre-order variants never show Notify me.
  `?tab=products` opens a tab directly. Copy in `data/back-in-stock.ts`, Hindi in
  `data/hi/back-in-stock.ts` (Signups still `untranslated`).

## Plugin (`packages/plugin-back-in-stock`)

- `settings-schema.ts`: new fields `enabled`, `title`, `buttonStyle`, `buttonBackground`,
  `buttonTextColor`, `buttonRadius`, `display`, the pop-up words, `newsletter`,
  `newsletterText`, `newsletterPrechecked`, `doubleOptIn`, `showOn`, `collectionIds`,
  `productIds`. Pure helpers `campaignShowsOn`, `notifyWidgetOf`, `describeProduct`,
  `BUTTON_RADIUS_REM`. `DEFAULT_NOTIFY_BUTTON_TEXT` is now "Notify me when available".
- `signups.ts`: `createSignup(..., { doubleOptIn })`; off confirms an email signup at once and
  queues no confirm email.
- `analytics.ts` (new): `analyticsSummary` (period + previous period) and `demandByVariant`.
  "Orders from alerts" = non-cancelled orders with the signup's email containing the alerted
  variant, placed within 14 days of the alert (`ORDER_WINDOW_DAYS`); nothing new is stored.
- Manifest pages: `''`, `campaign`, `signups`; FAQ answer updated (catalogue regenerated).
- API (`packages/api/src/routers/back-in-stock.ts`): `overview` takes `{ from, to }` and returns
  `usage`, `summary`, `campaign`, `variants`; `signups.export` added; `variantLabels` batch read.
  MCP action docs regenerated.

## Storefront

- `backInStockContext(tx, storeId, productId)` (cache key now per product) returns the
  `widget` and hides everything when the campaign is off or does not cover the product.
- `NotifyMeForm` → `notify-me-popup.tsx` (Essential's look: a full-width *Notify me when
  available* button in the sold-out box, theme-styled or custom colours, opening a centred
  pop-up reusing the `offer-modal` dialog) or `notify-me-fields.tsx` inline. The form checks the
  email first and shows the campaign's error; success swaps in the campaign's heading + message.
  `NotifyMeFormProps` gained `widget`, `productTitle`, `variantTitle` (buy box passes the variant).
  Hono island passes the same props.
- `notifyMeAction` reads the store settings for `doubleOptIn`, and a ticked newsletter box
  starts the store newsletter's own double opt-in (`requestNewsletterSignup`).
- Theme editor (Customize): a sold-out product now shows the campaign's Notify me button as a
  still picture (`components/themes/customize/notify-me-preview.tsx`, loaded in
  `use-customize-preview.ts`, drawn by `customize-preview.tsx`); before, the editor showed the
  sold-out box with no button.
- Custom button colours are inline styles and skip the theme's `.btn` (an imported theme's hover
  fill covered them); the pop-up's fields use utilities because the theme's sold-out panel
  rules do not reach inside the dialog.
- **Behaviour change for live stores:** the default display is the pop-up, and the default
  button text is "Notify me when available" (was an inline form and "Notify me").

## Not backed (Essential has it)

- "Send once inventory ≥ N": alerts fire on core's 0 → buyable `inventory.restocked`; a threshold
  needs core to emit on later increases.
- Gradient buttons, fonts, pixel sizes, per-element colours of the pop-up and email (theme and
  the email editor own the look); SMS; Klaviyo/Omnisend; translations; several campaigns (one
  campaign per store); button on collection lists / quick view.
- Turning the campaign off only hides the button; confirmed signups still get their alert.
