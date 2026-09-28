# Hindi in the admin

**Hindi in the admin** (27 September 2026, `feat/admin-hindi`, no migration): English or
हिंदी per member, picked on the new **Settings → Account** page (also top right of
`/onboarding`), stored in the `admin_locale` cookie and read by the root layout on the server
(`<html lang>`, `LocaleProvider`), so there is no flash. English stays the source in
`data/<feature>.ts`; Hindi is a typed overlay in `data/hi/<feature>.ts` (registered in
`data/hi/index.ts`) merged key by key, so anything untranslated shows English. The
`Translation<T>` type requires every key and rejects extras; `untranslated` marks a key left
in English on purpose. Components read copy with `useCopy(x)` (client) or `await getCopy(x)`
(server), and money/dates with `useFormat()` / `formatters(locale)`. Translated: onboarding,
Home, Orders (list + detail), Products (list + form), Settings → Payments (incl. gateway
setup), Settings → Shipping (incl. zones and rates), plus the sidebar, top bar, settings rail
and home, tables, relative dates and order/product status badges. `@commerce/money` spells
Hindi compact amounts (`₹1.2 लाख`). Word list: `docs/i18n-glossary.md`; developer docs:
Building, "Admin languages"; merchant guide: Settings, "Admin language". New copy in a file
that has a Hindi twin fails the typecheck until the Hindi (or `untranslated`) is added.
