# Security audit 2026-10-06 (`fix/security-audit-2026-10-06`)

Report: `docs/security/audit-2026-10-06.md` (A-00..A-18 fixed, D-01..D-10 open as issue text).
No migration.

- **Order pages by number (A-00, Critical)**: "Retry payment", "Pay balance" and "New QR" now
  need the owner's session or the order's view token (`canViewOrder`, `viewableOrderId`,
  storefront `lib/order-access.ts`); the components pass `viewToken`. Was on the paused 09-28
  branch, never merged.
- **Theme import**: zip entries inflated against their declared size (`archive.ts`, no more
  `unzipSync`); Liquid renders through `renderBounded` (2 s per pass, 6 s per page context, 4 M
  characters); layout split and live-page reading are forward-only; downloads capped
  (`THEME_MEDIA_LIMITS`) and the import counts against `heavy('import')`.
- **Nonces**: the storefront no longer adds the nonce to rendered HTML; `nonceThemeScripts`
  writes `{% commerce_script_nonce %}` into the theme's source at bundle build, so scripts that
  arrive in data never run. The Customize canvas uses `sanitize-html`
  (`@commerce/blocks/canvas-html`, `canvasSafeHtml`).
- **Config**: production refuses the default `SETTINGS_SECRET`; admin never logs sign-in codes
  or invite links in production.
- **Admin API**: `/api/rpc` refuses browser requests that are not same-origin
  (`lib/request-site.ts`); Better Auth's `/organization/create` is blocked
  (`lib/auth-paths.ts`).
- **Ported from `origin/fix/security-audit-2026-09-28`** (table in the report; the branch can be
  deleted): SES identity ownership, sender shared suffixes, reserved store/accounts domains,
  address given back on a refused organization, storage test errors hidden, discount and
  delivery-estimate rate limits, `cartDiscountView` moved to `lib/discount-view.ts`, PIN
  normalised in zone rules.

**Before deploying**: confirm production has `SETTINGS_SECRET` set and the platform email
account (`SENDER_EMAIL_PROVIDER=ses` + SES keys); without them the apps refuse requests / admin
sign-in says the code could not be sent (both intended).
