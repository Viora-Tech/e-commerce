# Agent skills: repository skills and a public Koomerce skills pack

Branch `feat/agent-skills` (from `origin/dev`). Markdown, JSON and docs only; no app code, no
migration. Modelled on the structure of Medusa's community skills (README index, CONTRIBUTING
listing rules, Agent Skills format); all text written here, nothing copied, so no
`THIRD_PARTY_NOTICES.md` entry.

## Repository skills (`.claude/skills/koomerce-*`)

For agents working on this monorepo. Each `SKILL.md` says when to use it and cites real paths
and commands (checked against `dev` on 20 Nov 2026); long material sits in a sibling file.

- `koomerce-conventions` (+ `reference.md`): component structure, copy and the Hindi overlay,
  rem, Tailwind only, 500 lines, `lint:components`.
- `koomerce-plugin-app` (+ `manifest-reference.md`): manifest, `access`, `tested` badge, settings
  pages, hooks, order actions, blocks.
- `koomerce-delivery-options`: rules → pool → pick → price → courier list, and the
  `shownPrices` / `orderDeliveryFor` consistency rule, with the tests to run.
- `koomerce-liquid-themes`: theme import, `liquid-theme.ts`, Customize and Puck; theme data and
  posters change only through the editor.
- `koomerce-checkout-orders`: `placeOrder` steps as wired today, store credit, COD, payments.
- `koomerce-testing`: what to run on the low-memory machine, per area; stale `node_modules`.
- `koomerce-release-flow` (+ `handoff-note-template.md`): branch → localhost → dev → main,
  `Fixes #n`, migration `when` ordering.
- `koomerce-emails`: templates on `dev`, and the shared blocks and composers that are on
  `feat/email-redesign-base` (not merged yet; the skill says so).

## Public pack (`skills/`)

- `README.md` (index and install), `CONTRIBUTING.md` (listing rules: format, target version,
  real tools only, confirm before writes, no secrets, nothing hidden, review before install),
  `.claude-plugin/marketplace.json` (marketplace `koomerce-skills`, one plugin per skill;
  `claude plugin validate ./skills` passes).
- `koomerce-store-agent` (+ `references/tools.md`): tool names taken from
  `packages/api/src/services/ai/assistant/registry.ts`, `packages/api/src/mcp/tools.ts`,
  `admin-actions.ts` and `apps/storefront/src/lib/agent-mcp.ts`. Update `tools.md` whenever
  those change.
- `koomerce-app-developer` (+ `references/manifest.md`), `koomerce-theme-developer`
  (+ `references/liquid-support.md`).

## Docs

New page `apps/docs/content/developer-docs/building/agent-skills.mdx`, in the Building nav after
MCP server and API tokens. `check-links` and `check-redirects` pass; the page compiles as MDX.

## For the owner

- Licence: the repo has no licence file, so the public skills set none. Pick one (MIT is usual
  for skills) before promoting the pack.
- `/plugin marketplace add Viora-Tech/e-commerce` reads only a root `.claude-plugin/`; the
  marketplace here installs from a clone or via `extraKnownMarketplaces` with `path`. Moving
  `skills/` to its own public repository later would make the one-line add work.
- Install URLs point at `main`, so they work after the next release.
