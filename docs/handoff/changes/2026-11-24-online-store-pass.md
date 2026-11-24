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

## Left for the owner (not built)

- Image picker: replacing a picture keeps the old picture's alt text (`withPicture`). Should a new
  picture take its own alt?
- Themes library rows have no Preview for an unpublished theme (only Customize). Add one?
- Customize's Preview link always opens the home page, not the page being edited.
- Redirects CSV import does not check for loops (single saves do).
- A theme published by a rollout adds no Version history entry (Publish does).

## Checks

`bunx vitest run` for core `src/navigation src/redirects src/online-store src/theme` and the admin
tests above pass. `bun run typecheck` in core, api and admin reports only errors already on
`origin/dev` in this worktree: `@commerce/payments-snapmint` and `write-excel-file/node` not
installed, and `customize-overrides.tsx(49)` (Puck types).
