# Imported-theme pages stop carrying the 404 template; what the heavy chunk really is

## Change
Next puts the not-found boundary's fallback (`app/-s/[storeId]/not-found.tsx`) in the RSC payload
of every page. Under an imported theme that fallback renders the theme's 404 template with
`inlineLiquid`, so every Waimers product, collection and content page carried about 67 KB (raw,
~5-10 KB gzip) of `section-404` markup in its payload, parsed by the browser, and rendered the 404
template on every server cache miss, for a fallback a page load never shows: a real 404 is Next's
empty error shell, its Liquid slots find no server markup, and the browser reloads once in the
themed mode (`lib/themed-rerender.ts`), where the boundary is drawn.

`lib/not-found-markup.ts` / `lib/not-found-rule.ts`: the 404 template now renders only on that
themed reload, on a payload-only answer (client navigation, action) and for our own themes.
`template-render.tsx` gains `rendersImportedTheme(storeId)`.

## Findings on "heavy JS" (37c7u_ag46xi1.js), not changed here
- `37c7u_ag46xi1.js` (240 KB raw) is React DOM + the Next app-router client (it also sets
  `_sentryRouteManifest`). It is the same on every page and cannot be deferred: hydration needs it.
  Its 340-680 ms in Lighthouse is hydration/commit work plus the style recalcs that commit triggers;
  the near-identical nagisa page measured 337 ms, so the 955 ms TBT on akatsukijishi is mostly
  run-to-run noise on a throttled CPU.
- The real main-thread cost is **Style & Layout**: 5.6 s (home), 2.9 s (akatsukijishi), 2.2 s (mice)
  versus 0.65-1.5 s of script. Causes: the storefront CSS chunk `09841dm8os3o5.css` is 552 KB raw /
  5,240 rules on every page, and ~400 KB of it is the Zero Drift React port's section CSS
  (`@commerce/blocks/styles.css`: product, hero, header, cart, signup...), which an imported Zero
  Drift theme ships again from `/theme-assets/`; plus 2.7-4.4k DOM elements and theme scripts that
  read layout after editing the DOM (`2iw4gj9few30e.js` = LiquidBoot running the theme's deferred
  scripts: 1.5 s total, 41 ms of it script).
- `1jnwhzgsxpukb.js` (347 ms) loads the Sentry SDK chunk; it already starts only after load + idle.
- PRs #1346/#1348 (unused blocks JS, zod) are separate and not duplicated here.
- Next step (needs visual QA): load the blocks section CSS only for our own themes, not under an
  imported theme.
