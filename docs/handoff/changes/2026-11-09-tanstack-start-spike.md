# Spike: admin Orders page on TanStack Start (9 Nov 2026)

Research only, not to be merged as a feature. Draft PR.

- `apps/admin-lab`: the admin Orders list on TanStack Start (SPA mode), reusing apps/admin's
  components through an `@/` alias and five thin Next shims (`src/shims`).
- `docs/research/2026-11-tanstack-start-spike.md`: build memory, bundle size, page timings and
  server memory, Next against TanStack Start; shim list; effort (about 7 to 9 weeks for all
  186 routes); recommendation: stay on Next. Adopt TanStack Query for list pages inside Next,
  and later consider splitting the API out of the Next process.
- `biome.json`: ignores generated `routeTree.gen.ts` files.
- apps/admin is unchanged.
