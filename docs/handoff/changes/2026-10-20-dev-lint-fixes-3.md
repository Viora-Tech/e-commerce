# Lint fixes after #608 and #612

Branch `chore/dev-lint-fixes-3`. No behaviour change, no migration.

- Biome formatting and import order on files from the payments Live/Test (#608) and metafield filters (#612) work.
- `gateway-switches.tsx`: the Active switch's wrapping `<label>` had no control biome could see; the switch now carries `aria-label` and the text sits beside it.
- `liquid-theme.ts` `listingQuery`: no assignment inside an expression.
