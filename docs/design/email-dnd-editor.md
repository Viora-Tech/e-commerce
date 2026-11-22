# Email editor: drag and drop (plan, 23 Nov 2026)

Settings → Notifications → a message → Edit design. Goal: work like Shopify's email editor.
Blocks on the left, drag to reorder, drag new blocks in from a palette, click a block to edit it
in a side panel, live preview with desktop and mobile, undo and redo.

## Build or adopt

| Option | Licence | Verdict |
| --- | --- | --- |
| **dnd-kit** (`@dnd-kit/core` 6, `/sortable` 10), already in `apps/admin` and `packages/ui` | MIT | **Chosen.** Every admin sortable already uses it (`SortableStack`, `useDndSensors`, `DragHandle`), with the keyboard sensor and the screen reader text. No new dependency |
| Puck (`@puckeditor/core` 0.24), the theme editor | MIT | No. Puck draws its canvas from React components in the page. Emails are drawn on the server by `packages/notifications` (React Email), so the preview has to be the server's HTML in an iframe. Puck would mean a second renderer for the same blocks and a different JSON shape than `email_template_design` |
| GrapesJS + grapesjs-mjml, the campaign visual builder | BSD-3-Clause, MJML MIT | No. Its free-form MJML is the wrong model for transactional emails, where the order's own blocks are locked and filled from real data. It also saves MJML, not our block JSON |
| Build undo/redo ourselves | n/a | Yes. About 60 lines (`design-history.ts`). A library (use-undo, zundo) would be more than the problem needs |

No `THIRD_PARTY_NOTICES.md` change: nothing is copied, dnd-kit is used as a dependency.

## Design

- **Same data.** The editor still saves `EmailTemplateDesign` (`version`, `subject`, `blocks`,
  `removed`) through `notifications.saveDesign`. No migration. `savePayload` only trims the
  subject, and a test checks the payload comes back unchanged from `parseEmailDesign`.
- **Layout.** From `xl`: three columns. On the left, the subject line, the palette and the
  block list (20rem). In the middle, the preview (desktop, or a 23.4375rem phone). On the
  right, the selected block's settings and the fill-in words (22rem). At `lg`, the settings
  move under the left column. Below `lg`, everything is in one column.
- **One drag area** (`design-outline.tsx`) holds the palette and the list:
  - A row dragged by its grip snaps to the closest row and only moves up and down.
  - A palette tile follows the pointer in a `DragOverlay`. It drops where the pointer is
    (`pointerWithin`): above the row under the pointer, shown by a line, or at the end in a
    zone under the list.
  - Rows make room only for a moved row (`rowsOnly` strategy), not for a new tile.
  - The pure drop rules are in `design-drop.ts`.
- **Keyboard.** Rows: Space to pick up, arrows to move, Space to drop. The announcements are
  in `data/email-design.ts`. Tiles: Enter or Space adds the block under the selected block,
  or above the footer. The keyboard does not start a drag on a tile, so Enter always adds.
- **Undo/redo** (`design-history.ts`): a reducer with past, present and future, 50 steps.
  Typing in one block, or in the subject, folds into one step. Use the top bar buttons,
  Ctrl/Cmd+Z, or Ctrl/Cmd+Shift+Z (or Ctrl+Y). A text field keeps its own native undo.
  "Unsaved changes" compares with the saved design, so undoing back to it clears the label.
- **Duplicate**: only the merchant's own blocks (not the intro or the order's slots), placed
  right below with a new id. Off when the email has 60 blocks (`DESIGN_LIMITS.blocks`).
- **Locks unchanged**: order blocks and the intro move but never go.

## Later

- Click a block in the preview to select it. This needs `data-block-id` attributes in the
  server HTML and a `postMessage` bridge out of the sandboxed iframe.
- Drag a tile straight onto the preview.
