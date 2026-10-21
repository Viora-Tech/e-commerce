# Theme editor: the AI chat sees the page and drafts page edits

Branch `fix/editor-ai-and-checkout-polish`. No migration.

Before: Customize → AI tab ("Build with AI") was the general admin assistant. Asking "which
sections are on this page?" or "change the announcement bar text to X" got "my tools only cover
sales, products…", because the editor path became page `other` and the model saw nothing of the page.

## What changed

- **Page context.** `ASSISTANT_PAGES` gains `theme-editor`; `pageContextFor` maps
  `/online-store/themes/<uuid>/editor` to it with the theme id. The API's page line reads the
  theme's name and whether it is live from the `theme` row under RLS.
- **Page outline.** With each message the AI tab sends a compact JSON outline of the open page,
  built client-side from Puck data (`apps/admin/src/lib/theme-outline.ts`): sections in order
  (header, page, footer) with id, zone, type, label (Liquid: `_name` / schema name; native: the
  Puck component label) and their text, textarea, richtext (as plain text), url, checkbox,
  number/range and select settings with current values; Liquid sections also list their blocks
  (nested blocks flattened) with block ids and settings. Values cut at 200 chars; the outline is
  fitted to 12 KB (settings dropped bottom-up first, then sections; the selected section last).
  Also sent: selected section id, theme name, template label, published flag. Shape, limits,
  `fitOutline`, the prompt rendering and the edit validation are one pure, client-safe module:
  `packages/ai/src/assistant/theme-outline.ts`.
- **Server.** `ai.assistant` input takes optional `theme` (zod `ThemeOutlineSchema`, bounded:
  60 sections, 40 blocks, 40 settings, 200-char values, 30 options, 12 KB total). Only on the
  `theme-editor` page: the outline goes into the prompt as JSON data passed through `guardData`
  (instruction-like page text hidden; a hit flags later proposals), with instructions to answer
  from it and to change things with `proposeThemeEdit`, never claiming a change before Apply.
- **`proposeThemeEdit`** (offered with `online_store.write`): `{ summary, edits: [{ sectionId,
  blockId?, setting, value }] }`, at most 20 edits. Every section/block/setting must be in this
  message's outline and the value must fit the kind (text vs boolean vs number in min/max,
  select option, safe URL); duplicates are refused. It writes nothing: it streams a `themeEdit`
  event (`{ id, summary, changes[], flagged }` with labels and the value before). It shares the
  3-proposals-per-message cap and the call is metered as the same assistant call as today. The
  store tools stay available (15 tools; outline ≤ ~3–4k tokens).
- **Client apply.** `ThemeEditCard` (`components/themes/customize/theme-edit-card.tsx`) shows the
  summary and each "Section › Block · Setting" with old (struck) and new value, Apply and Dismiss.
  Apply runs the pure `applyThemeEdits` (`lib/theme-edit-apply.ts`: section props at top level,
  block settings in `props.blocks[i].settings`, nested blocks too; richtext stored as escaped
  `<p>` HTML) via one Puck `setData` with `recordHistory: true`, so one Undo reverts it and
  Puck's `onChange` schedules the draft autosave. The card then says "Applied — not live until you
  publish", or on the live theme "Applied — this theme is live, so it shows on your store after
  you save" (Save commits the drafts, which on the live theme is what shoppers see). Copy:
  `data/customize-ai.ts` + `data/hi/customize-ai.ts` (registered). One AI-tab chip is now
  "Which sections are on this page?".
- `settingPropKey` is now exported from `packages/core/src/theme-import/fields.ts`;
  `blocksFromProps` dropped from the no-orphans allow-list (now imported).

## Files

- `packages/ai/src/assistant/{limits,prompt,theme-outline}.ts`, `packages/ai/src/{client,mock-plan}.ts`
- `packages/api/src/routers/ai.ts`, `packages/api/src/services/ai/assistant/{assistant,page-context}.ts`
- `packages/core/src/theme-import/fields.ts`
- `apps/admin/src/lib/{theme-outline,theme-edit-apply}.ts`, `apps/admin/src/hooks/use-assistant.ts`
- `apps/admin/src/components/themes/customize/{ai-panel,theme-edit-card,customize-layout,customize-editor}.tsx`,
  `apps/admin/src/components/assistant/assistant-turn.tsx`
- `apps/admin/src/data/{customize,customize-ai}.ts`, `apps/admin/src/data/hi/{customize-ai,themes,index}.ts`
- Tests: `packages/ai/test/theme-outline.test.ts`, `apps/admin/src/lib/{theme-outline,theme-edit-apply}.test.ts`,
  `packages/api/test/ai-assistant.test.ts` ("theme editor")
- Docs: developer docs "AI assistant" → "The theme editor"

## How to test

1. Online store → Themes → Customize an imported (Liquid) theme with an announcement bar. AI tab.
2. Ask "Which sections are on this page?": it lists the header, page and footer sections.
3. Ask "Change the announcement bar text to "Free shipping over ₹999"": a Page edit card shows
   Announcement bar › Announcement · Text, old → new. Apply: the canvas updates, "Unsaved changes"
   lights, Ctrl+Z undoes it. On a non-live theme the card says it is not live until you publish;
   on the live theme it says it shows after Save.
4. Same on a native theme (e.g. a Hero heading). Ask about sales in the editor: store tools still answer.
5. Automated: `cd packages/ai && bunx vitest run`; `cd apps/admin && bunx vitest run src/lib/theme-outline.test.ts src/lib/theme-edit-apply.test.ts`;
   `cd packages/api && TEST_DB_NAMESPACE=x bunx vitest run test/ai-assistant.test.ts` (mock provider
   plans `proposeThemeEdit` from the outline).

## Notes

- Images, colours, adding/moving/removing sections and native array items (columns, slides of our
  own sections) are not in the outline; the prompt tells the model to point to the editor for those.
- A member needs one of the assistant's existing permissions to see the AI tab at all;
  `online_store.write` alone does not open it (unchanged `ASSISTANT_PERMISSIONS`).
