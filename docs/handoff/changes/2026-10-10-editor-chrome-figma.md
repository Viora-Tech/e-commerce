# Editor chrome matches Figma 369:4809

Branch `feat/editor-chrome-figma`. The owner compared Customize with Figma frame 369:4809
(file YmMNC5JOimqg61sI0eFI5a); this matches it element by element.

- Rail: 64px, store tile, Add / AI / Pages / Layers / Media / Theme / Settings centred, Help pinned
  at the bottom, active tab `bg-primary-soft`, tooltips. New panels: `ai-panel.tsx` (admin assistant
  thread in the editor, link to Settings › AI when off) and `store-settings-panel.tsx` (links, new tab).
- Left panel: 304px, `panel-identity.tsx` ("<Store> · <Template>", domain).
- Add panel: "Sections | Blocks" switch, "Search layouts", folding category groups
  (`add-section-group.tsx`); My sections under Sections, Apps under Blocks; style step kept.
- Top bar: `displayThemeName` (normal case), page switcher restyled, "AI connected" chip
  (`ai.status.configured`), avatar with the account menu. The page loads store, member, live
  logo and AI status on the server.
- Canvas: Figma's 32/24px stage padding; block name chip flush on the block's top-left edge.
- Icons: `Layers` and `HelpCircle` in `packages/ui/src/icons-more.tsx`, re-exported from `@commerce/ui/icons` (icons.tsx is at its 500-line cap).
- Fonts: Puck's `--puck-font-family` names DM Sans (`--font-primary`) directly; editor chrome
  inside the canvas iframe (`[data-puck-overlay]`, `[data-editor-chrome]`) is set to DM Sans
  (it inherited the storefront theme's font), and `preview-frame.tsx` copies `--font-primary` onto
  the frame's root.
- Icons: Figma's set is Phosphor regular (icons page 104:109). Duotone glyphs in the chrome
  (template switcher's house, AI empty state) now regular; back is a caret; the device switch is
  Figma's 36×30 / 18px; the Add search has no magnifier (as 369:4908). Puck's built-in lucide
  formatting buttons are replaced by ours (`richtext-format-controls.tsx`) in both the canvas menu
  and a new right-panel menu (`field-format-menu.tsx`, `renderMenu`); only Puck's heading select
  (a text dropdown) remains.
- Not changed: the right inspector (not in this brief), the loading screen (its own PR).
- Tests written (not run): `lib/customize-theme-name.test.ts`; Add panel tests updated for the
  switch and folding groups.
- Docs: developer "Theme editor" (Editor chrome), merchant "Online store".
