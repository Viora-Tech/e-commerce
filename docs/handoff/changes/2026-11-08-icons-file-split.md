# Icons: theme editor glyphs split into icons-editor.tsx

`packages/ui/src/icons.tsx` was 525 lines, over the 500-line cap that `bun run lint:components`
enforces (#1304). The theme editor's section glyphs (`editorGlyphs`, `EditorGlyph`) and their 35
`Ed*` Hugeicons named imports moved to `packages/ui/src/icons-editor.tsx`, which `icons.tsx`
re-exports like `icons-more.tsx`. `icons.tsx` is now 444 lines.

No export name or import path changed: callers still import from `@commerce/ui/icons`. The
per-icon named imports stay; nothing uses `import *`.
