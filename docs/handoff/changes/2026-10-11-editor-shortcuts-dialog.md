# Theme editor: keyboard shortcuts dialog (2026-10-11)

The last small Figma item for the builder (392:10617). The Help panel, the page switcher popover and Save beside Publish were merged in #428.

- **`?` dialog** (`shortcuts-dialog.tsx`): a 560px dialog with every shortcut in two columns, and Close.
- **One shortcut list:** `lib/customize-shortcuts.ts` (`SHORTCUTS`) is drawn by `shortcut-list.tsx`, which both the Help panel and the dialog use.
- **New editor keys** (`editorKeyOf` + `useEditorKeys`, in the admin and the canvas frame, never while typing):
  - Ctrl/⌘ + S saves when there are changes; on the live theme that is Publish.
  - `/` opens Add (and leaves full view).
  - `?` opens the dialog.
  - `1 2 3` switch desktop, tablet and phone.
- **Not built** (in Figma's dialog): Publish ⌘⇧P, Preview ⌘P (it is the browser's print), and Inspect mode I (inspect mode waits for the owner's pick).
