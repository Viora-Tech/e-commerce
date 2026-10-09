# Admin redesign: leftover gaps (products, store, onboarding, shell)

Branch `feat/proofly-gaps-a`. Presentation only, no migrations.

- Card migration: handmade `bg-card ... shadow-card` containers (apps, home, content hub, media
  library, metaobjects, menu editor, automation node, SettingsCard, Settings home) now use
  `surface-card`, so dark mode gets the layered look.
- Products: purchase order and transfer line cards use the collection-products look (count chip,
  muted column band, hairline rows); gift card details are label/value rows.
- Online store: "Import a Shopify theme" is a page (`/online-store/themes/import`,
  `ImportThemeScreen`) with upload, working and failed states, replacing the dialog. The import
  is still one request, so the working state is an indeterminate bar, not per-step progress.
  Preferences uses `SettingsPageHeader`, `SettingsCard`, `SettingsRow` (`TextSetting` is now a row).
- Onboarding: two-column frame with the login brand panel (`OnboardingScreen`), one question per step.

Not done: the "Select products" dialog returns products and variant ids without cost or stock at
a location, so PO and transfer line search keep `VariantPicker`. Top bar glass: the shell keeps the
bar above the scrolling panel; scrolling under it would hide the panel's rounded top edge and
needs a browser check, so it is left as is.
