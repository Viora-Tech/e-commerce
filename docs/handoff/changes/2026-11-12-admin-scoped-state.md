# Admin browser storage is per store and member; draft previews show the latest save (12 Nov 2026)

Branch `fix/admin-scoped-state`.

## Browser storage scoped by store (and member)

- New `apps/admin/src/lib/storage-scope.ts`: `scopedStorageKey(base, scope, { perUser })`,
  `useStorageScope()`, `useScopedStorageKey()` and `dropLegacyUnscopedKeys()`. The scope
  (`storeId` + `userId`) comes from `components/layout/storage-scope-provider.tsx`, mounted in
  the `(admin)` and `(editor)` layouts. No store picked means no key: nothing is read or written.
- Now scoped by store and member: recent media (`media.pick.recent`), link-picker recents
  (`customize.link.recent`), dismissed set-up ideas on Home, the activity bell's "seen" mark
  (was per email only), AI answer snapshots handed to the report page, the assistant
  conversation (was per store only), sidebar recent apps (was per store only), palette recents
  (was per member only).
- Scoped by store only: provider "connection tested" badges (`connect-tested:<provider>`; a
  failed re-test in any provider's Connect page now drops it, not only Decentro's), the
  editor's block clipboard (memory and sessionStorage), the setup "next task" nudge counter.
- Old unscoped keys are deleted once on load, never migrated (their store is unknown).
- Left global on purpose (UI preferences): theme, sidebar state, Customize panel layout
  (`customize.panels.v1`), table and bulk-edit column choices, live globe settings, the Home
  enter animation flag. Left as is: the bulk-edit id hand-off (`orders-bulk-edit:ids`,
  `customers-bulk-edit:ids`), a same-tab hand-off read straight after it is written.
- Tests: `apps/admin/src/lib/storage-scope.test.ts`.

## Imported-theme draft preview

- Saving an Edit code draft only writes `theme_file.draft_body`, so the draft bundle's version
  (`<updated_at>|draft`) never changed, and `engineFor`'s parsed-template cache served the
  first draft's templates to every later preview. `loadThemeDraftBundle`
  (`packages/core/src/theme-import/bundle-store.ts`) now adds `draftDigest` (sha1 of every
  draft's path and text) to the version.
- Test: `packages/core/src/theme-import/draft-preview.test.ts` (two saves, preview shows the
  second).
