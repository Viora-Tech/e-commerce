# Markets and Rollouts in the main sidebar (30 Oct 2026)

Owner decision (audit #113): Markets and Rollouts leave Settings and become top-level sidebar
items, like Shopify's Markets. Committed straight to `dev`.

## Routes

| Old | New |
| --- | --- |
| `/settings/markets` | `/markets` (`routes.markets.list()`) |
| `/settings/markets/rollouts` | `/rollouts` (`routes.rollouts.list()`) |
| `/settings/markets/rollouts/new` | `/rollouts/new` (`routes.rollouts.new()`) |
| `/settings/markets/rollouts/<id>` | `/rollouts/<id>` (`routes.rollouts.detail(id)`) |

Old addresses redirect (307) through `SETTINGS_REDIRECTS` (`apps/admin/src/lib/settings-redirects.ts`,
served by `next.config.ts`); the test checks no code still links to them.

## Admin

- Sidebar (`data/navigation.ts`): **Markets** (Earth, `settings.read`) and **Rollouts** (Clock,
  `rollouts.read`) at the end of Workspace, after Discounts and above Sales channels.
- Removed from the Settings rail and Settings home (`data/settings.ts`); settings search still
  finds both (`data/settings-search.ts`). Page titles (`data/layout.ts`) and Hindi names moved to
  the new keys.
- Pages use the top-level list shell (`ProoflyListPage`), no "‹ Settings" back link; the rollout
  form sits in a centred `PageBody`. Markets lost its **Rollouts** button (the sidebar has it).
- Components moved: `components/settings/markets` → `components/markets` (`markets-settings.tsx`
  is now `markets-list.tsx`), `components/settings/rollouts` → `components/rollouts`.
- AI assistant: new page kinds `markets` and `rollouts` (`packages/ai/src/assistant/limits.ts`,
  `packages/api/src/services/ai/assistant/page-context.ts`).

## Docs

- Merchant guide: `settings/rollouts.mdx` → top-level `rollouts.mdx` (docs redirect added), new
  `markets.mdx`, both in the guide's sidebar after Discounts; Settings overview lists the move.
- Developer data model points at `/rollouts`.
