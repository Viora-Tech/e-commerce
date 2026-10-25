# Commerce monorepo

- React components follow one fixed file structure (props type, module-scope helpers, one
  `export default` component, hooks → derived → `handleX` arrows → early returns → single render).
  Rules and example: `docs/conventions.md`. `bun run lint` runs the checker.
- Copy lives in `data/<feature>.ts` (English; Hindi overlay in `data/hi/`, read it with
  `useCopy`/`getCopy`, see developer docs "Admin languages"); sizes in rem; Tailwind only, no handwritten CSS.
- Architecture: `apps/docs/content/developer-docs/getting-started/architecture.mdx`. Plugins:
  `apps/docs/content/developer-docs/building/plugins.mdx`. Admin design frames:
  `docs/design/admin-frames.md`. Guardrail sweeps (`bun run test:sweeps`): `docs/guardrails.md`.
- Starting fresh with no conversation history? Read `docs/handoff.md` first.
- Finding code: run `bun run code-map <folder or words>` first (e.g. `bun run code-map shipping`).
  It prints each file's purpose and exports in one go, so search less and open only what you need.
- Branches: `dev` is the default branch. Feature/fix branches start from `origin/dev` and open
  PRs **into `dev`**; `main` only moves by a `dev` → `main` release PR. Merged branches are deleted
  (GitHub auto-delete is on). The test server (vioratech.in) deploys `dev`. See developer docs
  "Deployment" → "Branches". Before a `dev` → `main` release, run the smoke checklist
  (developer docs "Release checklist"). Every bug is a GitHub issue (`bug` label); fix PRs say `Fixes #n`.
- Every PR records what it changed as a new file in `docs/handoff/changes/`
  (`YYYY-MM-DD-short-title.md`), never by editing `docs/handoff.md`, so parallel PRs don't conflict.
- New feature? First ask: build from scratch, or adopt from open source? Check
  `docs/open-source-radar.md`, verify the licence, and report candidates plus a recommendation
  before building. Credit anything adapted per `THIRD_PARTY_NOTICES.md`.
- Docs site: `apps/docs` (Nextra). Merchant guide and developer docs, `bun run dev:docs` on
  port 3500. See `apps/docs/README.md`.
