# Plain HTML pages: the theme CSS imported themes relied on (9 Nov 2026)

Phase 2 of `docs/design/storefront-plain-html.md`. Builds on the island PRs.

- **What was measured:** every element's computed style (and `::before`/`::after`) on the React
  page with our two global stylesheets on and off, desktop and phone, after scrolling through so
  reveal scripts ran: live Waimers (Zero Drift; home, about, faq, contact, reviews, roadmap) and
  Dawn 15.3 imported locally. For each difference, the rules of our sheets that set that property
  on that element (`scripts/plain-html/theme-css-reliance.mjs`), then only those declarations,
  with the custom properties and keyframes they read (`theme-css-extract.mjs`), written as
  `lib/plain-html/theme-compat.ts` (`theme-css-module.mjs`): 136 rules, 13 KB raw / 3.3 KB gzip,
  inline in the plain page's head before the theme's CSS (where the React page has ours), instead
  of 552 KB / 89 KB gzip.
- **What it holds:** Tailwind preflight pieces (border style, link colour and decoration, list
  style, image display/alignment, form fonts), our `* { margin: 0 }`, and block rules whose class
  names the themes share: on Zero Drift the kicker colour and capitals, the cookie banner's
  entrance and layout, the header menu pill, review cards, announcement size, footer colours; on
  Dawn `.page-width`, `.shopify-section`, the header's rounded lip and icon pill, `.rte`, `.price`,
  footer.
- **Left out on purpose:** the heading rise's hidden state (`html.js main :is(h1, h2, h3)` at
  opacity 0): it waits for a reveal script Dawn does not have, so Dawn's headings were invisible on
  the React page; Zero Drift has its own copy. Tailwind's `@layer properties` defaults.
- **Fonts:** Waimers' theme sets `--font-body: 'Plus Jakarta Sans'` but never loads it; on the
  React page our self-hosted next/font face drew it. The plain page now links our families that
  the page's markup names from Google Fonts, with the same weights (`theme-fonts.ts`). Without
  this Waimers would have fallen back to Noto Sans JP on every plain page.
- **Verified:** with only this file (our sheets off), the remaining differences on Waimers and
  Dawn are values that follow from layout and font (`transform-origin`, `px` widths of elements
  sized in `ch`, which change with the font: the comparison cannot load the Google Fonts link the
  plain page adds), the excluded heading rise, and Tailwind's `--tw-*` defaults.
- Not compared: open menus/drawers, hover and focus states, and other imported themes.
