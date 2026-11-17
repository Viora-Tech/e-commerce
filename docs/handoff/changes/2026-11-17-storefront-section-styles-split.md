# Storefront: section styles out of the global stylesheet

Every storefront page loaded all 56 blocks style files in one global stylesheet (about 550 KB on
Waimers' product pages). 24 of them style only sections of our own themes (hero carousel, drop
reveal, social wall, the Customize section library...) and match nothing on an imported theme's
product, collection, search, cart or account pages (checked on live waimers.in, desktop and phone).

- `packages/blocks/src/styles/shared.css`: the files every page needs; the storefront's
  `globals.css` imports it (`@commerce/blocks/styles-shared.css`).
- `packages/blocks/src/styles/sections.css`: the 24 section files. `index.css` imports both, so the
  admin is unchanged. Each of these files styles only its own classes, so loading it after the
  shared ones cascades as before.
- `scripts/storefront-css/sections-css.mjs` (`bun run css:sections`) minifies them with
  lightningcss (Next's browser targets) into `apps/storefront/src/lib/section-styles.generated.ts`,
  served at `/api/section-styles?v=<hash>` (cached a year). `section-styles.test.ts` fails when
  the module is older than the CSS files: re-run the script after editing one of them.
- Linked with `precedence="sections"` (after Next's stylesheet): our own themes on every page
  (`-s/[storeId]/layout.tsx`); an imported theme's page only when `renderTemplate` draws one of
  our sections other than Liquid sections, the Main* sections and Recently viewed.

Checked locally on the Waimers copy: our own theme, 7 pages × desktop and phone, pixel-identical
before and after. Imported theme: adding the section file back changes no computed style of any
element on home, product, collection, search, cart and account (desktop and phone). The global
stylesheet loses about 150 KB minified; the section file is about 151 KB for stores that need it.
