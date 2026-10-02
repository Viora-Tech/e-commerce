# Settings reorganised into six groups; personal pages moved to the account menu

**Branch** `feat/settings-reorganise` (from `main`), **no migration**. Owner's ask (2026-10-02):
"settings have so many routes, it feels confusing". 20 flat pages became 15 under six headings.

## The new map

| Group | Pages (route) |
| --- | --- |
| Store | Store details `/settings/store` (was General), Domains, Locations & warehouses `/settings/locations` |
| Selling | Payments, Checkout, Shipping & delivery `/settings/shipping`, Returns |
| Taxes & GST | GST & invoices `/settings/taxes`, three tabs: `gst-numbers` (default; was Business and GST), `tax-rules`, `invoices` |
| Customers | Customer accounts, Privacy & data requests `/settings/privacy` (+ `/requests`), Policies |
| Messages | Notifications |
| Team & advanced | Staff, AI, Custom data |

Left Settings: Account → `/account`, Appearance → `/account/appearance` (both in the avatar menu,
top right, with their own two-item rail, `app/(admin)/account/layout.tsx`); Files (storage
provider) → `/content/files/storage`, reached from a **Storage** button on Content → Files.

## Where it lives

- One list: `SETTINGS_GROUPS` in `apps/admin/src/data/settings.ts` (group headings in
  `settingsContent.groups`, Hindi in `data/hi/settings.ts`; page names and one-liners by route in
  `data/hi/navigation.ts`). `SETTINGS_SECTIONS` is the flat view of it (palette, i18n test).
- Rail: `components/settings/settings-nav.tsx`. From `md` up: search, Overview, the six headings.
  Phones: the Settings home is the list, every other page gets a "‹ Settings" back link.
- Home: `components/settings/settings-home.tsx`, checklist then one card per group, then a note
  pointing at Account, Appearance and file storage.
- Taxes & GST: `components/settings/taxes/taxes-gst-page.tsx` (server page loads
  `businessGst.get`). `BusinessGstSettings` is the first tab unchanged (minus its header);
  `TaxesSettings` stays mounted on every tab so its one save bar covers Tax rules and Invoice
  numbers and keeps unsaved edits across tab switches; it reloads `taxes.get` when the GST
  numbers change (the read-only default GSTIN). `SectionTabs` gained `hashTabs`: old card links
  (`#charging`, `#invoice-numbers`, `#e-invoice`, `#registration`, `#how-gst-works`) open the tab
  the card is on now.
- Redirects: `apps/admin/src/lib/settings-redirects.ts`, spread into `next.config.ts` as 307s
  (temporary on purpose: settings may move again). `lib/settings-redirects.test.ts` checks every
  old address has no page, every target is a page, no chains, and that no link in the admin,
  storefront, worker, `packages/*/src` or the docs still points at an old address.
- Avatar menu (`components/layout/top-bar.tsx`): Account and Appearance entries
  (`ACCOUNT_PAGES`, `data/account.ts`); Sign out now uses `onClick` (Base UI menu items do not
  fire `onSelect`, so it did nothing before).
- Docs: merchant guide `settings/_meta.ts` uses the same six separators; Business and GST merged
  into `settings/taxes.mdx` (`apps/docs/next.config.mjs` redirects the old guide URL).

## Not changed

Every page's inside is as it was. Payments, Checkout, Shipping and the rest kept their URLs;
only General, Business and GST, Customer privacy, Account, Appearance and Files moved.
