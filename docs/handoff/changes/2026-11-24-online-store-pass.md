# Online store bug pass (24 Nov 2026)

Branch `fix/online-store-pass` (from `origin/dev`). A code-reading QA pass over the theme editor,
the Themes page, menus, redirects and preferences. No migration. No theme data, posters or live
data touched.

## Fixed

1. **Menu "Custom URL" items** (`packages/core/src/navigation/resolve.ts`, `items.ts`,
   admin `components/navigation/menu-item-dialog.tsx`). A `javascript:` link was stored and reached
   imported Liquid themes' menus unfiltered (React escapes it, Liquid does not); `instagram.com/x`
   became a broken store path. Saving refuses script/data URLs (`isScriptUrl`), `itemPath` drops any
   already stored, and the dialog runs `normalisePastedUrl` (bare domain gets `https://`, half paths
   refused, copy `menus.item.badUrl` + Hindi). Test: core `navigation/url-items.test.ts`.
2. **Video setting poster lookup / image drop upload** (`customize/video-setting-field.tsx`,
   `image-field.tsx`). Both wrote back a copy of the value taken before their request; a mobile link
   or alt text typed meanwhile was lost, and a late poster for a replaced link restored the old
   link. They now build on the latest value (ref). Tests: `video-setting-field.test.tsx`,
   `image-field.test.tsx`.
3. **English toasts in a Hindi admin**: Customize's "changes from your last visit" toast and the
   template rename/duplicate/delete toasts read the English copy directly. Now `useCopy`. Test:
   `lib/customize-editor.test.ts`.
4. **Preferences fallback** (`packages/core/src/online-store/preferences.ts`). One unreadable part
   reset every preference to defaults, which switched the password page off and blanked the home
   SEO title. Each part now falls back on its own. Test: `preferences.test.ts`.
5. **Publish from the Themes library** asked nothing; Customize already confirms. The library now
   shows the same `PublishThemeDialog`. Test: `components/themes/themes-library.test.tsx`.
6. **Redirect loops**: `/new → /old` was accepted while `/old → /new` existed (too many redirects).
   `saveRedirect` follows the target's redirects (10 hops) and throws `RedirectLoop` (API: CONFLICT).
   Test: core `redirects/redirects.test.ts`.

## Built after the owner said yes (same day)

7. **Replaced image brings its own alt** (`customize/image-field.tsx` `withPicture`): the media
   item's alt, empty when it has none. Alt typed while a dropped file uploads is still kept. Test:
   `image-field.test.tsx`.
8. **Preview in the Themes library row menu** for themes that are not live
   (`theme-actions-menu.tsx` `previewHref`, new tab; the row now takes `origin`). Test:
   `theme-actions-menu.test.tsx`.
9. **Customize's Preview opens the page being edited** (`lib/customize-preview-path.ts`): the
   product, collection or page chosen in the picker (collection and page resources now carry their
   handle), `/cart`, `/search`, `/account`, `/account/login`, `/404`; `?view=<suffix>` for an
   alternate; the home page when nothing is chosen, and for blogs and posts (no picker yet).
   `previewUrl` joins the token with `&` when the path has a query. Test:
   `lib/customize-preview-path.test.ts`.
10. **Redirects CSV import skips looping rows** (`redirectCsvLoops`, core `redirects/service.ts`):
    the file is checked against the stored redirects as they will be once written; in each loop the
    row furthest down the file is left out, and the check repeats. The import and its dry-run
    preview drop those rows and list them with the file's problems (the reason text is English,
    like the other CSV problems). Test: core `redirects.test.ts`.
11. **Rollouts add a Version history entry** when they put a theme live, at the start and on roll
    back (`publishLogged`, core `rollouts/changes.ts`), only when the theme was not live already.
    Test: core `rollouts/rollouts.test.ts`.

## Checks

`bunx vitest run` for core `src/navigation src/redirects src/online-store src/theme src/rollouts`
and the admin tests above pass. Core DB tests share the per-worker `commerce_test_core_w*`
databases with other worktrees: run them when no other session is testing, or stores vanish
mid-test (foreign key errors). `bun run typecheck` in core, api and admin reports only errors already on
`origin/dev` in this worktree: `@commerce/payments-snapmint` and `write-excel-file/node` not
installed, and `customize-overrides.tsx(49)` (Puck types).
