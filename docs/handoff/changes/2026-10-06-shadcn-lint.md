# Design lint with @shadcn/lint

- Added `@shadcn/lint` + `oxlint` (dev deps, MIT), `.oxlintrc.json` (only `shadcn/*` rules, all
  `warn`), `components.json` in apps/admin, apps/storefront and packages/ui for per-app theme
  discovery, and `bun run lint:design`. Biome is unchanged.
- Baseline 1,525 warnings (mostly `no-restyle` in admin), to be cleared in the UI revamp.
  Details: `docs/design/design-lint.md`. Credited in THIRD_PARTY_NOTICES.md.
