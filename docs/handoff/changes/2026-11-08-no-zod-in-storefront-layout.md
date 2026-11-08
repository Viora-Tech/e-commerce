# Storefront layout: zod no longer shipped to every page

- `packages/core/package.json` declares `"sideEffects": ["./src/search-console/service.ts"]`:
  the one core file that runs code on import (`setSearchQueriesSource`). Every other file can
  now be dropped from a bundle when nothing uses it, so the browser-safe front doors
  (`@commerce/core/theme-import`, `/marketing`, `/inbox`) no longer drag their zod schema
  files into the layout's client code. A new core file that must run on import has to be added
  to that list.
- `@commerce/plugin-umami/tracker` (new, zod-free) holds `UmamiTracker` and `umamiAllowed`;
  `settings.ts` re-exports them. The consent manager imports the tracker file.

Probe (`bun build`, browser, minified, server actions stubbed) of the five layout client
components (consent manager, app-block slot, discovery tracker, market suggestion, chat
widget): 829 KB with zod → 723 KB without; 248 KB together with the blocks `sideEffects` change.
