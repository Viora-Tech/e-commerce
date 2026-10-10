# Loops (list bindings), part 2: editor

Branch `feat/loops-editor` (plan C2b), stacked on `feat/loops-core` (#385).

- **Use content from…** on every repeatable field with fillable items
  (`customize-array-field.tsx`): a dialog (`loop-dialog.tsx`) to pick a content type or a
  collection's products, a row limit (≤ 50) and what each item field shows (first map guessed by
  `guessMap` in `lib/customize-loops.ts`).
- While linked: `loop-linked-panel.tsx` (source, rows right now, what each row shows, Change,
  Unlink) replaces the editable rows; the Sections tree offers no add/remove for it.
- Canvas: `DynamicSourceSection` fills lists with sample rows from `themes.templates.loopValues`
  (new), cached per source and limit; `themes.templates.loopSources` (new) feeds the dialog.
- Core additions: `previewCollectionProducts`, `loadLoopCatalog` (loop-service.ts); a map
  entry with `from: ""` now empties that field on every row (otherwise the first typed row's
  text would repeat on each).
- Browser-checked on a duplicated theme: Team linked to a content type with 3 entries, limit 2,
  canvas showed the 2, Unlink restored the typed people, Save stored the loop.
- Tests (not run): new case in `loops.test.ts`.
