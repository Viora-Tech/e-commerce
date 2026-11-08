# Theme pictures load Playwright on demand (8 Nov 2026)

`apps/worker/src/theme-screenshot.ts` imports `playwright-core` and `sharp` inside `photograph()`, on the first picture, instead of at worker start. Same behaviour on failure (warning, old picture kept). Saves about 17 MB heap and tens of MB resident while no picture is taken.
