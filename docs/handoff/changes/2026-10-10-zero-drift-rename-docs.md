# Zero Drift rename, part 2: tests, docs and comments

Branch `chore/zero-drift-rename-docs` (on top of `chore/zero-drift-rename-code`, #365).

- Test files `packages/blocks/test/glide-*.test.tsx` → `zero-drift-*.test.tsx`, their describe
  names now say Zero Drift.
- `docs/design/glide-theme-port.md` → `docs/design/zero-drift-theme-port.md`; every reference
  updated (conventions, theme-editor.mdx, code comments).
- Code and CSS comments that named the theme now say Zero Drift (blocks, admin, storefront, core
  theme). Product copy that uses "glide" as a word ("Glide faster", "The Fastest Glide in the
  Game", the "Glide Mouse" test product) is unchanged.
- Merchant guide: the Zero Drift section intro no longer says the theme used to be called
  Glide; what's new and the developer docs say Zero Drift.
- There are no `glide` CSS class prefixes (the ported stylesheets use the theme's own BEM names),
  so no CSS rename is needed. Old handoff notes keep the old paths as history.
