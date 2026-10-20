# Third-party notices

Code, templates and assets adapted from other projects, with their licences. Every package
that adapts outside work keeps the full licence text next to it; this file is the index.

| Project | Licence | What we adapted | Where | Full notice |
| --- | --- | --- | --- | --- |
| [invoicely](https://github.com/legions-developer/invoicely) | MIT, used with the author's permission | PDF invoice templates (`default`, `vercel`), rupee formatter, per-script font fallback, live preview loop | `packages/invoices` | [`packages/invoices/THIRD_PARTY_LICENSES.md`](packages/invoices/THIRD_PARTY_LICENSES.md) |
| [Saleor Dashboard](https://github.com/saleor/saleor-dashboard) | BSD 3-Clause | Admin layout patterns (top nav, list filter bar, datagrid density and pager, card anatomy, detail main + side layout), re-implemented on our shadcn/Base UI | `apps/admin/src/components/layout`, `apps/admin/src/components/table` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [shadcn/ui blocks](https://ui.shadcn.com/blocks) (login-02, InputOTP) | MIT | Two-column sign-in layout and the 3 + dash + 3 code field pattern, rebuilt on our components without the `input-otp` package | `apps/admin/src/components/auth` | MIT, Copyright (c) 2023 shadcn |
| [Macaw UI](https://github.com/saleor/macaw-ui) | CC BY 4.0 | Theme token values (neutral palette, borders, overlay shadows, type steps), modified | `packages/ui/src/styles.css` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| Inter, Geist, Noto Sans (+ Devanagari, SC) | SIL Open Font License 1.1 | Fonts embedded in invoice PDFs | `packages/invoices/fonts` | `OFL.txt` beside each family |
| [cobe](https://github.com/shuding/cobe) | MIT | Dotted 3D WebGL globe (no borders) on the Home card, patched with a detailed land map (`patches/cobe@2.0.1.patch`). Our own Live view globe re-implements its look (sphere and dot shading, halo, marker and arc sizes) in new code | `apps/admin/src/components/analytics/live-globe` (`live-globe-canvas.tsx`; look only in `webgl/globe-renderer.ts`, `webgl/overlay-points.ts`) | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Natural Earth](https://www.naturalearthdata.com/) 1:50m land; 1:10m admin-0 countries, India point of view | Public domain | 1:50m land rasterised into the cobe patch (Home card globe). 1:10m India point-of-view countries rasterised to `apps/admin/public/globe/globe-2048.png` (Live view globe: land, coastlines and India's official boundary), and resampled to border-run points with cumulative arc length in `apps/admin/public/globe/borders.bin` (Live view globe's "Border style: Dashed") | `patches/cobe@2.0.1.patch`, `apps/admin/public/globe/`, `scripts/globe/` | Public domain, credited as "Made with Natural Earth" |
| [Magic UI](https://magicui.design) | MIT | Marquee, Number Ticker, Shine Border and Bento Grid patterns, adapted for `LogoMarquee`, `TestimonialMarquee`, `StatsCounter`, `CtaBanner` and `BentoGrid` | `packages/blocks/src/components/sections` | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Magic UI](https://magicui.design) | MIT | Marquee, the 3D Marquee demo and Safari components (shadcn registry source), restyled with the theme's variables, for the Glide theme sections | `packages/blocks/src/effects` (`marquee.tsx`, `marquee-3d.tsx`, `safari.tsx`) | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Magic UI](https://magicui.design) | MIT | Retro Grid (CSS version), Border Beam, Word Rotate, Number Ticker and Magic Card, adapted as shared effects (theme colours, rem, Motion loaded after hydration, still under reduced motion) for the starter kit sections `GridHero`, `RotatingHero`, `ShowcaseHero`, `StatsCards`, `CtaCard`, `FeatureCards`, `PricingCards` (and `StatsCounter`, which now uses the shared Number Ticker). Avatar Circles followed as a pattern only. Licence verified on GitHub (`magicuidesign/magicui`, MIT) 2026-10-10 | `packages/blocks/src/effects` (`retro-grid.tsx`, `border-beam.tsx`, `word-rotate.tsx`, `number-ticker.tsx`, `magic-card.tsx`) | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Aceternity UI](https://ui.aceternity.com) (free components) | Aceternity UI licence (end products allowed, no redistribution of the items); builder use permitted in writing, see [`docs/licences/aceternity-pro.md`](docs/licences/aceternity-pro.md) | Lens, 3D Card Effect, Meteors, Animated Tooltip and Focus Cards (shadcn registry source), restyled with the theme's variables, for the Glide theme sections | `packages/blocks/src/effects` (`lens.tsx`, `card-3d-container.tsx`, `meteors.tsx`, `animated-tooltip.tsx`, `focus-cards.tsx`) | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [react-data-grid](https://github.com/adazzle/react-data-grid) | MIT | The spreadsheet grid of the bulk product editor (cell editing, copy/paste, fill handle), themed with our tokens | `apps/admin/src/components/products/bulk-edit` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Shopify Product Taxonomy](https://github.com/Shopify/product-taxonomy) | MIT | Category list (release `v2026-08`, trimmed to id and name by `scripts/trim-product-taxonomy.ts`) for the product category picker and the `product.category` dynamic source | `packages/core/src/catalog/product-taxonomy.json`, `apps/admin/src/lib/product-taxonomy.ts` | [`packages/core/THIRD_PARTY_LICENSES.md`](packages/core/THIRD_PARTY_LICENSES.md) |
| [react-phone-number-input](https://gitlab.com/catamphetamine/react-phone-number-input) 3.4.18 and [libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js) 1.13.15 (plus its dependency [country-flag-icons](https://gitlab.com/catamphetamine/country-flag-icons)) | MIT, Copyright (c) @catamphetamine (read from each package's LICENSE, 2026-10-11) | Phone input state, number formatting, country list and flag SVGs; used as libraries behind our own picker (Popover + Command), no code copied. libphonenumber-js also validates and normalises numbers to E.164 | `packages/ui/src/components/phone-input.tsx`, `packages/core/src/accounts/phone.ts` | MIT, Copyright (c) 2016 @catamphetamine |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) 0.23.6 and [grapesjs-mjml](https://github.com/GrapesJS/mjml) 1.0.8 (bundles [mjml-browser](https://github.com/mjmlio/mjml) 4.18, MIT); [MJML](https://github.com/mjmlio/mjml) 5.4.1 | BSD-3-Clause, Copyright (c) 2017-current Artur Arseniev (GrapesJS, grapesjs-mjml); MIT, Copyright (c) 2016 Mailjet SAS (MJML). Read from each package's LICENSE, 2026-10-20 | The visual email builder for campaigns, used as libraries (no code copied): GrapesJS with the MJML preset in the admin, loaded on demand; `mjml` compiles designs to email HTML on the server | `apps/admin/src/components/growth/campaigns/visual-builder`, `packages/core/src/marketing/email-design-compile.ts` | LICENSE inside each npm package |

Paid UI kits: Aceternity UI Pro, Magic UI Pro and shadcnblocks may be used in builder blocks under
the owner's written permission — see [`docs/licences/aceternity-pro.md`](docs/licences/aceternity-pro.md),
[`docs/licences/magic-ui-pro.md`](docs/licences/magic-ui-pro.md) and
[`docs/licences/shadcnblocks.md`](docs/licences/shadcnblocks.md). Sections built from these
patterns (batch 1, 2026-09-26): `SpotlightHero` (Aceternity UI), `BentoGrid`, `LogoMarquee`,
`TestimonialMarquee`, `StatsCounter`, `CtaBanner` (Magic UI, free MIT components — see the row
above), `SplitHero`, `VideoHero`, `FaqAccordion`, `Gallery` (shadcnblocks patterns, no Pro code
copied).

The starter kit's `LogoCloud`, `CtaSplit`, `FeatureSteps`, `FeatureChecklist`,
`TestimonialGrid`, `TestimonialSpotlight`, `FaqSplit`, `ComparisonTable`, `Lookbook`,
`NewsletterBand`, `Timeline`, `TeamGrid` and `TrustBadges` are our own layouts
after common patterns; no code is copied. The Add panel's section pictures are made by a dev-only script with
[puppeteer-core](https://github.com/puppeteer/puppeteer) (Apache License 2.0, admin dev dependency,
nothing of it ships).

Libraries installed from npm are not listed here; their licences ship inside `node_modules`.
Two are worth naming because the upload-time image pipeline (`packages/core/src/media/pipeline.ts`,
run in `apps/worker`) depends on them directly rather than adapting any of their code:
[sharp](https://github.com/lovell/sharp) (Apache License 2.0) for image decode/resize/encode, and
[thumbhash](https://github.com/evanw/thumbhash) (MIT) for the blur-up placeholder.
The theme editor's Custom HTML element is sanitised by
[sanitize-html](https://github.com/apostrophecms/sanitize-html) (MIT, dependency of
`packages/blocks`, used through `packages/blocks/src/embed-sanitize.ts`; its own dependencies
htmlparser2, postcss, deepmerge, escape-string-regexp, is-plain-object, parse-srcset and launder
are MIT too), licence verified on npm and its GitHub `LICENSE` on 2026-09-27. Layout blocks use
Puck's slots (MIT, already our editor); no code is copied.
Long-form section copy in the theme editor (Rich text, Text) keeps pictures through
[`@tiptap/extension-image`](https://github.com/ueberdosis/tiptap) 3.31.3 (MIT, the same Tiptap
Puck's richtext field is built on), a dependency of `apps/admin` used in
`apps/admin/src/lib/customize-config.tsx`; no code is copied.
Merchant passkeys (Account → Sign-in & security, and "Sign in with a passkey" on the admin login)
use Better Auth's passkey plugin, [`@better-auth/passkey`](https://github.com/better-auth/better-auth)
1.7.6 (MIT, read from its `package.json` on 2026-10-10), as a dependency of `packages/auth`; it
runs on the same SimpleWebAuthn packages listed below. No code is copied.
Shopper sign-in (`packages/core/src/shopper-login/`) uses, without copying code,
[Better Auth](https://github.com/better-auth/better-auth) 1.7.6 (MIT, already our merchant
auth) for its Google, Apple and Facebook provider modules and `verifyGoogleIdToken`,
[SimpleWebAuthn](https://github.com/MasterKale/SimpleWebAuthn) (`@simplewebauthn/server`
13.3.3 and `@simplewebauthn/browser` 13.3.0, MIT) for passkeys, and
[jose](https://github.com/panva/jose) 6.2.12 (MIT) to sign Apple's client secret; licences read
from each package's `package.json` in `node_modules` on 2026-09-28 (the docs hosts were blocked
from the build machine). Google Identity Services (One Tap) is Google's hosted script, loaded
from `accounts.google.com`, never copied.
The AI engine (`packages/ai`, "Write with AI" and "Ask your store") is built on the
[Vercel AI SDK](https://github.com/vercel/ai): `ai` 7.0 (including its `ai/test` mock models),
`@ai-sdk/gateway` 4.0 and `@ai-sdk/provider` 4.0, all Apache License 2.0, plus
[`@openrouter/ai-sdk-provider`](https://github.com/OpenRouterTeam/ai-sdk-provider) 3.1 (Apache
License 2.0); licences read from each package's npm metadata (`npm view <pkg> license`) on
2026-10-02. Used as libraries behind our own interface (`packages/ai/src/engine.ts`); no code is
copied.
Shopify theme import (`packages/core/src/theme-import`) renders a merchant's own uploaded theme with
[LiquidJS](https://github.com/harttle/liquidjs) 10.30.0 (MIT, Copyright (c) 2016 Jun Yang / harttle),
licence verified with `npm view liquidjs license` and its GitHub `LICENSE` on 2026-10-02. Used as a
library behind our own engine (`engine.ts`); no code is copied. The Shopify-only tags, filters and
objects (`form`, `image_url`, `money`, `product`, `collection`...) are our own implementations
written from Shopify's public Liquid reference; no Shopify code is used. The themes merchants
upload stay theirs: the upload dialog asks them to confirm they own the theme or hold the rights,
since Theme Store themes are usually licensed for Shopify only.
Content type field types (CMS PR2, `packages/core/src/metaobjects`, admin
`components/metaobjects`) take ideas, no code, from two MIT projects: the "Rows of fields" group
(a list of rows with their own fields, one level deep) and per-field `subfields` config follow
[Payload CMS](https://github.com/payloadcms/payload)'s `array` field (MIT, as recorded in
`docs/open-source-radar.md`), and naming a row after its first text follows the repeater
summary of [Instatic](https://github.com/CoreBunch/Instatic) (MIT, Copyright (c) 2026 David
Babinec; `LICENSE` read from the owner's local copy on 2026-10-02). Our schemas, checks and
inputs are written from scratch.
The test server's "Report a bug" button (`apps/admin/src/lib/capture-page.ts`) takes its page
screenshot with [modern-screenshot](https://github.com/qq15725/modern-screenshot) 4.7.0 (MIT,
Copyright (c) 2021-present wxm), licence verified with `npm view modern-screenshot license` and its `LICENSE` on 2026-10-05.
Used as a library, loaded only when a screenshot is taken; no code is copied.
Reading uploaded purchase documents (`packages/ai/src/purchase-documents/prompt.ts`, run in
`apps/worker`) takes a PDF's text layer with [unpdf](https://github.com/unjs/unpdf) 1.8.1 (MIT,
Copyright (c) 2023-PRESENT Johann Schopplich), which ships a serverless build of Mozilla's
[PDF.js](https://github.com/mozilla/pdf.js) (Apache License 2.0). unpdf's licence read from its
`package.json` and `LICENSE` in `node_modules` on 2026-10-10; PDF.js's from its GitHub `LICENSE`.
Used as a library, loaded only when a document is read; no code is copied.
Framework credit, not an adaptation: `apps/docs` (the docs site) is built with
[Nextra](https://github.com/shuding/nextra) (MIT), verified on
[npm](https://www.npmjs.com/package/nextra) and its
[GitHub `LICENSE`](https://github.com/shuding/nextra/blob/main/LICENSE); its footer credits
Nextra too.

### Pending: India PIN code directory (not included yet)

Checkout's "PIN code first" (Settings → Checkout) fills city and state from India Post's
[All India Pincode Directory](https://www.data.gov.in/catalog/all-india-pincode-directory),
published on data.gov.in under the Government Open Data Licence - India (GODL-India), which
allows use and redistribution with attribution. **No data from it is in the repository yet**:
the session that built the feature could not reach data.gov.in (blocked by its network
policy), so neither the dataset nor the licence text could be downloaded and verified, and no
third-party copy was substituted. To add it:

1. Download the CSV from data.gov.in and read the licence shown on the dataset page.
2. Run `bun scripts/build-pincode-directory.ts <file.csv>`; it writes
   `packages/shipping/data/pincode-directory.json.gz` (PIN code → district and state).
3. Replace this section with a table row: Project "All India Pincode Directory (Department of
   Posts, via data.gov.in)", Licence "GODL-India, with attribution", What we adapted "PIN
   code → district and state, reduced to one row per PIN code", Where
   `packages/shipping/data/pincode-directory.json.gz`, and keep the licence text in
   `packages/shipping/THIRD_PARTY_LICENSES.md`.

Until then checkout works as before: shoppers type city and state.

**India Post app, live lookups** (`packages/shipping-indiapost/src/pin-directory.ts`): with a
merchant's own data.gov.in API key, the India Post app asks the same directory's official API
(resource `5c2f62fe-5afa-4119-a499-fec9d604d5bd`) about one PIN code at a time and keeps the
answer in memory for a day. GODL-India was read on the data.gov.in catalog page on 2026-10-20.
Nothing from the dataset is stored in the repository. Attribution: All India Pincode Directory,
Department of Posts, Ministry of Communications, Government of India, via data.gov.in, under
the Government Open Data Licence - India. The Speed Post Parcel rates in
`packages/shipping-indiapost/src/data/speed-post-parcel-tariff.ts` are a government tariff
(facts, typed by hand from indiapost.gov.in); credit: Department of Posts.

**PIN prefix → state check** (security audit D-06, `packages/core/src/checkout/pincode-state.ts`):
until the directory is installed, `placeOrder` checks the typed state against a small table of
the first two digits of a PIN code and the states each can belong to. It was written by hand
from India Post's public PIN code allocation (the "Postal Index Number" zones published by the
Department of Posts, indiapost.gov.in). These are public facts; no dataset or text was copied,
so there is no licence to carry. Credit: Department of Posts, Government of India.

## Adding an entry

Before copying or closely adapting code from another project:

1. **Check the licence.** MIT, BSD and Apache 2.0 may be adapted. GPL, AGPL, SSPL, BSL, FSL and
   "fair-code" licences (for example n8n's) may not: learn from the design, don't copy the code.
2. **Keep the notice.** Put the project's copyright line and full licence text in a
   `THIRD_PARTY_LICENSES.md` in the package that uses it, saying which files were adapted.
3. **Mark the files.** A short comment at the top of each adapted file: what it came from and
   the licence, e.g. `Adapted from invoicely's formatCurrencyText (MIT).`
4. **Add a row above.**

Candidate projects, with verified licences and what to take from each: [`docs/open-source-radar.md`](docs/open-source-radar.md).

## @theguild/remark-mermaid

- Used in: `apps/docs` (renders Mermaid diagrams in MDX pages)
- Licence: MIT — https://github.com/dimaMachina/nextra (The Guild)

## @shadcn/lint and Oxlint

- Used in: repo root dev tooling (`bun run lint:design`, `.oxlintrc.json`): design-system lint
  rules for Tailwind (no restyling shared components, theme tokens only, no inline styles).
- Licences: `@shadcn/lint` MIT (shadcn) — https://github.com/shadcn-ui/lint ;
  `oxlint` MIT (oxc project) — https://github.com/oxc-project/oxc. Installed as dev
  dependencies; no code copied.

## Chatwoot

- Used in: the Chatwoot app (`packages/plugin-chatwoot`, `apps/admin/src/components/apps/chatwoot`,
  `apps/storefront/src/components/support/chatwoot-widget.tsx`). The storefront loads the store's
  own Chatwoot website SDK (`<chatwoot>/packs/js/sdk.js`) from the store's Chatwoot server or
  Chatwoot Cloud, and the server calls Chatwoot's Application API. No Chatwoot code is copied or
  bundled, and nothing from its `enterprise/` folder is used.
- Licence: MIT (Expat) outside `enterprise/`, Copyright (c) 2017-2026 Chatwoot Inc. —
  https://github.com/chatwoot/chatwoot (licence checked on GitHub 2026-10-20).

## Umami

- Used in: the Umami app (`packages/plugin-umami`, `apps/admin/src/components/apps/umami`,
  `apps/admin/src/components/analytics/visitors-section.tsx`,
  `apps/storefront/src/components/analytics/umami-script.tsx`). The storefront loads the
  store's own Umami tracker (`script.js`) from the store's Umami server or Umami Cloud, and the
  admin reads Umami's REST API. No Umami code is copied or bundled.
- Licence: MIT, Copyright (c) 2022 Umami Software, Inc. — https://github.com/umami-software/umami
  (licence checked on GitHub 2026-10-10).

## Third-party app logos (trademarks)

- Used in: `apps/admin/public/app-logos/` (Apps page, install step): Cashfree, Decentro, Delhivery,
  RapidShyp, Razorpay and Shiprocket logos.
- These are trademarks of their owners, shown only to identify the integration. No endorsement is
  implied. Taken from the approved design file; replace with each company's brand-kit asset if they
  supply one.
