# Theme editor fixes from testing an imported Shopify theme (30 Oct 2026)

- Block names never use a select value: a hero's video slides read "Video slide", not
  "full_bleed" (`customize-liquid-tree.ts`, `OPTION_VALUE`).
- Setting help text sits below its input with a gap; a negative margin pulled it over the
  input's bottom edge (`customize-overrides.tsx` `SettingHelp`).
- No sideways scrollbar in an imported theme's canvas: hidden variant radios inside a scrolling
  carousel escaped its clip in the editor (the section wrapper is positioned) and widened the
  frame; the canvas now clips horizontal overflow, as the storefront page has none
  (`preview-frame.tsx`).
- Theme editor layers: the "insert here" line has its + in the middle, line on both sides,
  as on the canvas (`add-section-popover.tsx`).
