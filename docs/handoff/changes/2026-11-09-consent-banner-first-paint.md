# Cookie banner shows with the first paint (imported themes)

The imported theme's cookie banner (`<cookie-banner hidden>`, Zero Drift / Waimers revamp) was
unhidden only by the theme's deferred `cookie-banner.js`, which waits for React to hydrate and then
for the section's delay (1 s on Waimers). On text pages it was the biggest thing painted that late,
so it set Largest Contentful Paint: on 16 of 36 measured Waimers pages, about 6.5 s on a phone.

- `apps/storefront/src/lib/liquid-consent-reveal.ts`: right after each `</cookie-banner>` the
  section render adds a small nonced inline script that makes the theme's own decision while the
  page is parsed (shim's `shouldShowBanner()`, i.e. our consent cookie, plus the theme's
  "answered recently" localStorage stamp) and unhides the banner, focusing its region as the theme
  does. Applied in `renderLiquidSections` (`lib/liquid-theme.ts`), so cached section HTML carries it.
- Consent is unchanged: the script only reveals; the theme's script still binds the buttons, every
  answer still goes through the shim to `ConsentManager`, and no tag loads before a yes. With no
  shim, in the editor (`designMode`), or for a `#cookie-settings` link it leaves the banner to the theme.
- Visible change: the section's "delay" setting no longer delays the banner on the storefront.
- Cached section renders pick it up when the store version changes or the render cache expires.
