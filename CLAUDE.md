# Commerce monorepo

- React components follow one fixed file structure (props type, module-scope helpers, one
  `export default` component, hooks → derived → `handleX` arrows → early returns → single render).
  Rules and example: `docs/conventions.md`. `bun run lint` runs the checker.
- Copy lives in `data/<feature>.ts`; sizes in rem; Tailwind only, no handwritten CSS.
- Architecture: `docs/architecture.md`. Plugins: `docs/plugins.md`. Admin design frames:
  `docs/design/admin-frames.md`.
- Starting fresh with no conversation history? Read `docs/handoff.md` first.
