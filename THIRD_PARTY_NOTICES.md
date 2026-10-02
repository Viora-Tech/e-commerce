# Third-party notices

Code, templates and assets adapted from other projects, with their licences. Every package
that adapts outside work keeps the full licence text next to it; this file is the index.

| Project | Licence | What we adapted | Where | Full notice |
| --- | --- | --- | --- | --- |
| [invoicely](https://github.com/legions-developer/invoicely) | MIT, used with the author's permission | PDF invoice templates (`default`, `vercel`), rupee formatter, per-script font fallback, live preview loop | `packages/invoices` | [`packages/invoices/THIRD_PARTY_LICENSES.md`](packages/invoices/THIRD_PARTY_LICENSES.md) |
| [Saleor Dashboard](https://github.com/saleor/saleor-dashboard) | BSD 3-Clause | Admin layout patterns (top nav, list filter bar, datagrid density and pager, card anatomy, detail main + side layout), re-implemented on our shadcn/Base UI | `apps/admin/src/components/layout`, `apps/admin/src/components/table` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Macaw UI](https://github.com/saleor/macaw-ui) | CC BY 4.0 | Theme token values (neutral palette, borders, overlay shadows, type steps), modified | `packages/ui/src/styles.css` | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| Inter, Geist, Noto Sans (+ Devanagari, SC) | SIL Open Font License 1.1 | Fonts embedded in invoice PDFs | `packages/invoices/fonts` | `OFL.txt` beside each family |
| [cobe](https://github.com/shuding/cobe) | MIT | Dotted 3D WebGL globe (no borders) on the Home card, patched with a detailed land map (`patches/cobe@2.0.1.patch`). Our own Live view globe re-implements its look (sphere and dot shading, halo, marker and arc sizes) in new code | `apps/admin/src/components/analytics/live-globe` (`live-globe-canvas.tsx`; look only in `webgl/globe-renderer.ts`, `webgl/overlay-points.ts`) | [`apps/admin/THIRD_PARTY_LICENSES.md`](apps/admin/THIRD_PARTY_LICENSES.md) |
| [Natural Earth](https://www.naturalearthdata.com/) 1:50m land; 1:10m admin-0 countries, India point of view | Public domain | 1:50m land rasterised into the cobe patch (Home card globe). 1:10m India point-of-view countries rasterised to `apps/admin/public/globe/globe-2048.png` (Live view globe: land, coastlines and India's official boundary), and resampled to border-run points with cumulative arc length in `apps/admin/public/globe/borders.bin` (Live view globe's "Border style: Dashed") | `patches/cobe@2.0.1.patch`, `apps/admin/public/globe/`, `scripts/globe/` | Public domain, credited as "Made with Natural Earth" |
| [Magic UI](https://magicui.design) | MIT | Marquee, Number Ticker, Shine Border and Bento Grid patterns, adapted for `LogoMarquee`, `TestimonialMarquee`, `StatsCounter`, `CtaBanner` and `BentoGrid` | `packages/blocks/src/components/sections` | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Magic UI](https://magicui.design) | MIT | Marquee, the 3D Marquee demo and Safari components (shadcn registry source), restyled with the theme's variables, for the Glide theme sections | `packages/blocks/src/effects` (`marquee.tsx`, `marquee-3d.tsx`, `safari.tsx`) | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Aceternity UI](https://ui.aceternity.com) (free components) | Aceternity UI licence (end products allowed, no redistribution of the items); builder use permitted in writing, see [`docs/licences/aceternity-pro.md`](docs/licences/aceternity-pro.md) | Lens, 3D Card Effect, Meteors, Animated Tooltip and Focus Cards (shadcn registry source), restyled with the theme's variables, for the Glide theme sections | `packages/blocks/src/effects` (`lens.tsx`, `card-3d-container.tsx`, `meteors.tsx`, `animated-tooltip.tsx`, `focus-cards.tsx`) | [`packages/blocks/THIRD_PARTY_LICENSES.md`](packages/blocks/THIRD_PARTY_LICENSES.md) |
| [Shopify Product Taxonomy](https://github.com/Shopify/product-taxonomy) | MIT | Category list (release `v2026-08`, trimmed to id and name by `scripts/trim-product-taxonomy.ts`) for the product category picker and the `product.category` dynamic source | `packages/core/src/catalog/product-taxonomy.json`, `apps/admin/src/lib/product-taxonomy.ts` | [`packages/core/THIRD_PARTY_LICENSES.md`](packages/core/THIRD_PARTY_LICENSES.md) |

Paid UI kits: Aceternity UI Pro, Magic UI Pro and shadcnblocks may be used in builder blocks under
the owner's written permission — see [`docs/licences/aceternity-pro.md`](docs/licences/aceternity-pro.md),
[`docs/licences/magic-ui-pro.md`](docs/licences/magic-ui-pro.md) and
[`docs/licences/shadcnblocks.md`](docs/licences/shadcnblocks.md). Sections built from these
patterns (batch 1, 2026-09-26): `SpotlightHero` (Aceternity UI), `BentoGrid`, `LogoMarquee`,
`TestimonialMarquee`, `StatsCounter`, `CtaBanner` (Magic UI, free MIT components — see the row
above), `SplitHero`, `VideoHero`, `FaqAccordion`, `Gallery` (shadcnblocks patterns, no Pro code
copied).

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
