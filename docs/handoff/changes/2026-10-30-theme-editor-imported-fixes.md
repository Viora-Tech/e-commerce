# Theme editor fixes from testing an imported Shopify theme (30 Oct 2026)

- Block names never use a select value: a hero's video slides read "Video slide", not
  "full_bleed" (`customize-liquid-tree.ts`, `OPTION_VALUE`).
- Setting help text sits below its input with a gap; a negative margin pulled it over the
  input's bottom edge (`customize-overrides.tsx` `SettingHelp`).
