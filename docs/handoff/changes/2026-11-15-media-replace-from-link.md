# Media: replace a photo from a link (same row, same places)

`media.replaceFromUrl({ id, url })` (API and MCP action, content write): the server fetches the
https link through `safeFetch` (public hosts only, redirects re-checked, upload size cap), checks
it is an image, writes it to a fresh key and points the existing media row at it. The row keeps
its id, so product galleries, variant photos, order and alt text are untouched. It goes back to
`processing` with its old variants kept until the pipeline writes the new ones (no gap on the
store); the old original is deleted, its old variant files are left.

- Core: `packages/core/src/media/replace.ts` (`replaceImageFromUrl`), tests in `replace.test.ts`.
- Queue: `addMediaProcessJob` / `enqueueMediaProcess` take an optional job id; a replacement
  uses `<mediaId>-replace-<time>` because the media id's own job may still be kept as done.
- Why: Waimers' 53 Pulsar/TalonGames products were imported from Shopify at 480 px (Shopify's
  `_large` copies); the brands' sites have the same photos at 1600 px.
- No admin button yet; the swap runs through the MCP action.
