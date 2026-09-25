# Commerce monorepo

- React components follow one fixed file structure (props type, module-scope helpers, one
  `export default` component, hooks → derived → `handleX` arrows → early returns → single render).
  Rules and example: `docs/conventions.md`. `bun run lint` runs the checker.
- Copy lives in `data/<feature>.ts`; sizes in rem; Tailwind only, no handwritten CSS.
- Architecture: `apps/docs/content/developer-docs/architecture.mdx`. Plugins:
  `apps/docs/content/developer-docs/plugins.mdx`. Admin design frames:
  `docs/design/admin-frames.md`. Guardrail sweeps (`bun run test:sweeps`): `docs/guardrails.md`.
- Starting fresh with no conversation history? Read `docs/handoff.md` first.
- New feature? First ask: build from scratch, or adopt from open source? Check
  `docs/open-source-radar.md`, verify the licence, and report candidates plus a recommendation
  before building. Credit anything adapted per `THIRD_PARTY_NOTICES.md`.
- Docs site: `apps/docs` (Nextra). Merchant guide and developer docs, `bun run dev:docs` on
  port 3500. See `apps/docs/README.md`.
