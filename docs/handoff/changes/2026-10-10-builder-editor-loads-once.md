# Theme editor loads once

Branch `fix/builder-editor-loads-once`.

- Customize used to mount `<Puck>` twice on open: first with an empty installed-apps config,
  then again (its `key` carried an `appsVersion`) once `api.apps.list()` came back, which flashed
  the editor and dropped selection and panel state.
- `apps/admin/src/app/(editor)/online-store/themes/[id]/editor/page.tsx` now reads `apps.list`
  on the server with the theme and passes `installedApps` to `CustomizeEditor`, which builds the
  Puck config once. The client fetch, `appsVersion` and `setConfig` are gone; the `key` is only
  template, suffix and discard nonce, so template switches and Discard still remount as before.
- Test: `apps/admin/src/lib/customize-config.test.ts` (installed app blocks reach the Apps tab
  from the first build).
