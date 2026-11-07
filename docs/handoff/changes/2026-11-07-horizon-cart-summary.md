# Cart summary on Horizon themes (2026-11-07)

- `packages/blocks/src/styles/base.css`, scoped to `:root:has(#header-group)` so Waimers is
  unchanged: the discount code label is screen-reader only (Horizon's `.field__label` covered
  the input), Apply matches the input height, and the UPI "Save" amount uses the theme's
  foreground colour. Fixes #1257.
