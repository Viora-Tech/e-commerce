# Back in stock settings: two-column sections, storefront settings, waiting pill (13 Nov 2026)

Figma 928:12095 "Back in stock · Settings (pattern)".

- Settings page (`apps/admin/src/components/apps/back-in-stock/`): Channels, Sending and
  Storefront as two-column sections (title + help left, card right, dividers), Discard/Save in
  the page header instead of the floating SaveBar (a `LeaveGuard` still asks before leaving
  unsaved). Layout components are local to this app (`settings-section`, `toggle-field`,
  `select-field`); the shared settings components are unchanged. Copy now goes through
  `useCopy`, with a Hindi overlay (`data/hi/back-in-stock.ts`; Overview and Signups still
  English, marked `untranslated`).
- "Alerts per minute" is a select (10…2000, plus any stored value) with the hint
  "A restock of 500 signups goes out over about N minutes" from `restockMinutes()`.
- New settings in `BackInStockStoreSettingsSchema` (now in `settings-schema.ts`, exported as
  `@commerce/plugin-back-in-stock/settings-schema` for client code): `buttonText` (default `''` =
  the storefront's "Notify me") and `askPhone` (default `true`). Stored rows without them parse
  to today's behaviour. No migration: settings are a JSON column.
- Storefront: `backInStockContext` returns `buttonText` and only asks for a WhatsApp number when
  `askPhone` is on too. The buy-box form and the Notify me app block use the button text (a label
  typed on the block itself still wins).
- App bar: the plugin now has an `appBar` read, "N shoppers waiting on M variants" (confirmed or
  pending signups, one statement, `settings.read` only) and the Signups count in the sidebar.
