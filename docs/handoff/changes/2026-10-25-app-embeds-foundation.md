# App embeds foundation (2026-10-25)

Apps can now declare **app embeds**: site-wide widgets (chat bubble, pixel, banner) drawn once per page, as opposed to app blocks which are page sections.

- `packages/plugins/src/types.ts`: `AppEmbedDefinition`, `PluginStorefront.embeds`.
- `packages/core/src/theme/schema.ts`: `theme.appEmbeds` — per-embed `{ enabled, settings }`, keyed `<pluginId>/<Name>`, default `{}` so old themes parse unchanged.
- `packages/core/src/theme/app-embeds.ts`: `resolveAppEmbeds` (defaults + saved settings, unknown keys dropped, `enabled` falls back to `enabledByDefault`), `appEmbedSources` (installed apps only, namespace checked).
- `packages/core/src/plugins/registries.ts`: `appEmbedSourcesForStore`.
- Storefront: `components/theme/app-embeds.tsx` mounted in the store layout (liquid and native themes).

No app ships an embed yet. Next PR: theme editor "Apps" rail tab (replaces Media) to toggle embeds and edit their settings.
