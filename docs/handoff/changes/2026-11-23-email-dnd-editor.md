# Email editor: Shopify-style drag and drop (23 Nov 2026)

The owner asked for Settings → Notifications → a message → Edit design to work like
Shopify's email editor. Branch `feat/email-dnd-editor-v2`, not merged yet: the owner checks it
on localhost first. The plan and the build-or-adopt choice are in
`docs/design/email-dnd-editor.md`. It uses dnd-kit (MIT), which was already in the admin, and
adds no dependency.

## What changed (`apps/admin/src/components/notifications/design/`)

- **Three columns from `xl`.** Left: the subject line, "Add a block" and the blocks. Middle:
  the live preview with Desktop and Mobile. Right: the selected block's settings and the
  fill-in words (`design-settings-panel.tsx`). At `lg` the settings sit under the left column.
- **Drag in from the palette** (`design-outline.tsx`, `design-palette-tile.tsx`,
  `design-end-zone.tsx`). A tile follows the pointer. A line shows where the block will go,
  above the row under the pointer, or in the drop zone at the end. The new block is selected.
  Clicking a tile, or Enter on it, still adds the block below the selected one.
- **Reorder** as before, by the grip or from the keyboard (Space, arrows, Space). The palette
  and the list now share one drag area, so `SortableStack` is no longer used here.
- **Duplicate** on the merchant's own blocks. The copy goes right below, with a new id.
  Duplicate is never offered on the intro or the order's blocks, and is off at 60 blocks.
- **Undo/Redo** in the top bar, or Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) outside text
  fields. Typing in one block, or in the subject, is one step. History keeps 50 steps.
  "Unsaved changes" now compares with the saved design, so undoing back to it clears the label.
- **Same saved JSON.** `savePayload` sends `{ version, subject?, blocks, removed }`, the shape
  `email_template_design` already stores. No migration and no API change.
- **Pure logic** sits in `design-history.ts` (the reducer and shortcuts) and `design-drop.ts`
  (drop rules). `design-state.ts` gained `insertBlock`, `moveBlock`, `duplicateBlock`,
  `canAdd`, `canDuplicate` and `savePayload`.
- **Copy**: new keys in `data/email-design.ts` and the Hindi overlay (undo, redo, duplicate,
  drop zone, settings title, and screen reader lines for new blocks).

## Tests

- `design-history.test.ts`: undo, redo, grouping, the limit, load and the shortcuts.
- `design-drop.test.ts`: move, add from the palette, the end zone, the limit, duplicate,
  remove, and the save payload. The payload is round-tripped through `parseEmailDesign`.
- `design-editor-sidebar.test.tsx`: duplicate, click to add and the unknown-word alert.
  The alert now shows in the settings panel.

All 30 pass. The branch worktree has no node_modules, so they were run with wt-all's
packages. A typecheck of the changed files was done the same way. Only API-typed values
were left untyped, because `@orpc/server` cannot be resolved from outside the repo.
Run `bun install` in the branch and then the usual checks before merging.

## Later

- Click a block in the preview to select it (needs block ids in the server HTML and a
  message bridge out of the sandboxed iframe).
- Drop a palette tile straight onto the preview.
