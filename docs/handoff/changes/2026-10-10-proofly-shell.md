# Admin redesign 1/n: Proofly shell, tokens, siteConfig, routes

Branch `feat/proofly-shell`. Foundation for the Proofly look (Figma `YmMNC5JOimqg61sI0eFI5a`,
Foundations `357:377`, Home `223:275` light and `223:436` dark). Page PRs build on this one; no page
content was redesigned here. Developer docs: Building > Admin design system.

## Tokens and fonts
- `packages/ui/src/styles.css` (imported only by the admin, so the storefront is unchanged): Proofly
  light and dark values under the Figma code-syntax names, plus `--raised`, `--hairline`,
  `--chip-neutral`, `--key-*` (primary) and `--key-neutral-*`, `--card-*`, `--shadow-04..14`,
  `--highlight-06`. `--action` is now the one blue. Radius base 12px (panel 16, controls 10, chips 8).
- `key-primary` and `key-neutral` are Tailwind utilities (gradient, top highlight, bottom lip, glow).
- Type: body and nav 14px, page title 32px 700 (Bricolage), `text-stat` 28px 700 (Bricolage).
  DM Sans (400/500/600) and Bricolage Grotesque (700/800) via `next/font/google` in `app/layout.tsx`;
  Geist removed.
- The member accent picker (`@commerce/core/admin-accent`) still overrides `--primary*` at runtime.
  "One blue" holds only until a member picks another colour; decide in a later PR whether to keep it.

## siteConfig
`packages/config/src/site.ts`, import `@commerce/config/site` (pure data, client-safe): brand, contact
(support email, WhatsApp number and `whatsappHelpUrl()`, phone), URLs, locale (INR, en-IN,
Asia/Kolkata, date patterns, "Today"/"Yesterday"), UI defaults (rows per page 10/25/50/100 default 10,
toast ms), plan limits, social. Values marked PLACEHOLDER (domain, support email, WhatsApp number,
URLs, social) must be set before go-live. The three literal "Vextro" strings (notification templates,
samples, bug-report user agent) now read it; admin copy reads it too (`navigation.search.field`).
The date stamp "Today 4:05 pm / Yesterday 9:12 am / 5 Oct" is `formatWhen` in `lib/format-date.ts`
(the "n days ago" step is gone).

## Routes map
`apps/admin/src/lib/routes.ts` covers every route under `app/(admin)` plus login, onboarding,
select-store, accept-invitation. Migrated: `data/navigation.ts`, `data/command-palette.ts`,
`data/settings.ts`, `data/account.ts`, `app/(admin)/layout.tsx`, the sidebar, user menu and states.

## Sweeps
- `admin-routes`: no new hardcoded admin href; allow-list is a count per file (about 150 files,
  the TODO list for the page PRs; `data/settings-search.ts` keeps hash/query links until `routes`
  gets a query helper). Counts may only go down.
- `site-config`: the brand name literal may appear only in `site.ts`.

## Shell
Sidebar (store switcher with key tile, domain pill, Workspace / Sales channels / Apps / Settings,
chevron sections, soft blue active fill, usage card, user row with Settings, Help on WhatsApp,
English/हिंदी and Log out), collapsible to an icon rail from the top bar toggle. Top bar: toggle,
"Search or ask Vextro AI…" (opens the palette), Ask AI key pill (opens the assistant), View store,
bell, theme, avatar menu. Content panel is a 16px rounded inset with a hairline. The old desktop AI
pill at the bottom is gone (mobile round button stays).
- Usage card needs billing data that does not exist yet: pass `usage` to `AdminSidebar` when it
  does; until then it is hidden.

## Shared components
Button (`default` = key-primary, `key-neutral`, `outline`, `ghost`, `loading` prop), `StatusChip`,
`StatTile` (default/hover/active filter, trend), table (header, 48px rows, `RowActionsCell` open + ⋯
at 40% to 100%, footer "Showing x–y of n", rows-per-page select when `onPerPageChange` is passed,
floating bulk bar), `PageState` / `PageSkeleton` / `InlineState`, `FloatingBar` (SaveBar uses it),
sonner toast styling. `RouteError` and the admin not-found use `PageState`.

## Left for page PRs
- Pass `onPerPageChange` and use `siteConfig.ui.rowsPerPage.default` in each list (they still pass
  their own page sizes); adopt `StatTile` and `StatusChip` in Home, Orders, Products.
- Migrate the allow-listed hardcoded hrefs; add real usage data to the sidebar.
- Detail pages still use the flat "sections" layout; redesign them per Figma.
- Old kit components (`components/kit/*`) and `StatCard` keep the previous look, now with the new
  tokens.
