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

## Version 2: the full editor (23 Nov 2026)

The owner asked for a full editor, not only reordering: every block's words and look
editable, order details still filled in from the real order.

### Adopt an editor core, or extend ours

| Option | Licence | Fit | Verdict |
| --- | --- | --- | --- |
| **React Email 6 editor** (`@react-email/editor`, Resend, April 2026) | The React Email repo is MIT; the editor package's own licence was not confirmed, check its LICENSE before any use | TipTap/ProseMirror document editor that exports HTML. Its document is the source of truth, so it has no idea of a locked block filled from `TemplateData` at send time | No |
| **Easy Email** (zalify/easy-email) | MIT | MJML block tree, saves its own JSON and outputs MJML. Order blocks would have to be MJML placeholders we re-fill, and the server would need MJML in the send path | No |
| **Templatical** (@templatical/editor) | FSL-1.1-MIT (source-available, turns MIT two years after each release); renderers MIT | Vue, not React; its own JSON; 14 blocks | No (licence and framework) |
| **Maily** (maily.to) | MIT | TipTap-based, Markdown-like editing for one-off emails; no data-bound blocks | No |
| **Extend ours** | n/a | Keeps one JSON (`email_template_design`), one server renderer that fills order blocks from `TemplateData`, and the existing dnd-kit list, undo and preview | **Chosen** |

Every core above makes its own document the truth and exports static HTML. Our emails are
drawn on the server on every send with the real order, and the order's own blocks must never be
removable. None keeps that, so we extend ours. Nothing is copied from them, so
`THIRD_PARTY_NOTICES.md` does not change.

### Schema, version 2

`DESIGN_VERSION` is 2. Every new field is optional, so `parseEmailDesign` reads a version 1
row as version 2 with the same blocks, and it sends the same email (a test checks the HTML is
identical). Save goes through `checkEmailDesign`, the same reader as a send but strict: anything
a send would drop (an unknown block, an unsafe link, a bad cell, a locked block listed as
removed) is an error. Core's `EmailTemplateDesignSchema` calls it, so there is one reader.

- `styles` on the design: font from `EMAIL_FONTS` (fonts every inbox has), size 13 to 18,
  text, heading, link, highlight, page and card colours, width 480 to 720, button style.
  The same object can sit in Email branding (`EmailBranding.styles`); it then applies to every
  email, built-in or designed, and a design's own styles sit on top (`mergeStyles`).
- `box` on every block: background band, space above and below, alignment.
- `edit` on slot blocks, limited per kind by `SLOT_EDITS` (`style-types.ts`): words over the
  built-in ones (variables allowed, empty keeps the built-in), parts switched off, colours, and
  the main button's style. Items: heading, total label; photos, variant, quantity, notes, line
  prices, totals and GST can be hidden; name and rule colours. Status and notice: title, second
  line, colours. The data (lines, totals, codes, route) is always the order's.
- New free blocks: `hero`, `products` (picked products kept as they were: title, price, picture,
  handle), `coupon`, `video` (thumbnail and play line linking out), `html` (cleaned by
  `sanitizeEmailHtml`, an allow-list with no dependency, on save and again after variables are
  filled), `columns` (one to three, holding heading, text, image, button and spacer blocks).
- Text blocks with `rich: true` read `**bold**`, `*italic*`, `[words](https://...)`, `- ` and
  `1. ` lists (`rich-text.ts`). New text blocks are rich; old ones stay plain.
- Help box: own title, text, WhatsApp button on or off. Footer: own note, address on or off,
  up to six links.

### Rendering, email-client safe

Output stays tables and inline styles; nothing uses flex or grid (a test checks the columns
block). Columns are table cells with the existing `k-stack` class, so phones stack them. The
font, text and heading colours and size are laid over the finished HTML (`design-look.ts`): the
built-in font stack is swapped, `color:` of the ink and body tokens is swapped (never
`background-color:`), and every px size scales from the 15px body. Page, card and width go
through `EmailLayout`'s `look`.

### Editor

- Right column has two tabs: Block (the selected block's fields, then Layout) and Email styles.
- Order blocks show their words, parts, colours and button style (`design-slot-fields.tsx`).
- Columns list each column's blocks with edit, move up, move down and remove, and an add menu.
  Editing a block inside a column opens its fields with "Back to the Columns block".
- Rich text: a toolbar over the textarea inserts the marks (`rich-marks.ts`), so the native
  undo of the field keeps working. Editing inside the preview is not built (stretch goal).
- Images, hero and video thumbnails use the media library picker; products use the Browse
  picker.
- "Use for all emails" saves the email styles in Email branding; the branding page keeps them
  when it saves its own fields.

## Later

- Click a block in the preview to select it. This needs `data-block-id` attributes in the
  server HTML and a `postMessage` bridge out of the sandboxed iframe.
- Drag a tile straight onto the preview.
- Edit text inside the preview (needs the same bridge).
- Drag blocks between columns and the main list (today: the add menu and up and down buttons).
- Show and edit the shared email styles on the Email branding page itself.
- The built-in (undesigned) email takes the shared font, colours, size, page and width, but not
  the button style; designed emails take all of it.
- The plain-text part keeps the built-in words for order blocks; it does not follow slot edits.
