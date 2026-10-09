# Admin redesign: Online store (Themes, Preferences, website builder chrome)

Branch `feat/proofly-onlinestore`. Figma `YmMNC5JOimqg61sI0eFI5a`: Themes `309:19887`, builder
section selected `369:4809`. Presentation only: every query, save, publish and draft behaviour is unchanged.

## Themes and Preferences
- `Themes | Preferences` switch (`components/themes/online-store-tabs.tsx`) under the page title on both pages.
- Current theme card: thumbnail left; name with a neutral Live chip, "Current theme · last saved …",
  Preview, Customize (key button) and the kebab (Rename, Duplicate, Download settings).
- Theme library: centred empty state with "Duplicate current theme" and "Add from preset".
- Imported chip is a `StatusChip`; every link uses `routes.onlineStore.*` (admin-routes allow-list lowered by 5).

## Website builder chrome (the existing Puck editor)
- Top bar: back to Themes, theme name and Live chip; page/template switcher centred (wider popover,
  home icon); device switch with the real canvas width ("Full width / 768 px / 390 px"); undo and redo
  (moved from the floating dock); Preview (storefront preview link, needs `origin` prop from the route);
  the key button. **Publish semantics unchanged:** on the live theme the key button reads Publish and
  runs the old Save (commit drafts + settings); on an unpublished theme it stays Save and the menu keeps
  "Publish" (make the theme live) and Discard.
- Icon rail: brand mark on top, Add / Sections / Theme settings centred, tooltips on the right.
- Right inspector: Basic (the section's own fields) and Advanced (Layout, Spacing, Style, Advanced
  groups) tabs when the selection has the shared groups; done with a `data-advanced` marker on
  `SectionSettingsGroups` and CSS on the Puck form, so field state and editing are untouched.
- Canvas dock now only holds the light/dark switch, and only when the theme has dark mode.
- Hindi: `data/hi/themes.ts` (registered on sub-objects of `themesContent` and `customizeContent`).

## Not done (needs features that do not exist yet; nothing faked)
AI tab, Pages / Media rail panels, Help item, code editor and "Edit code" menu item, MCP indicator,
dynamic-source panel redesign, version history, market preview, zoom percentage, "Blocks" tab in the
Add panel (Sections / Apps / My sections tabs stay), page-switcher "Pages + Templates" groups (the
switcher still groups by template kind), left panel header "Store · Page", theme import page frames
(only link migration), Preferences card re-skin beyond the tab switch, trash button in the inspector header.
