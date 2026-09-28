# Shopify-import images processed automatically

**Shopify-import images processed automatically** (27 September 2026,
`feat/import-media-processing`, no migration): every image the importer re-hosts (API and CSV
runs) is queued on the existing `{media}-process` job as soon as its row is written, so
`bun run media:reprocess` is no longer needed after an import. New `ctx.processMedia(mediaId)`
on the plugin job context (`AppHookContext`), backed by the worker's media queue through
`DispatchDeps.mediaProcess`; job id = media id via the new throwing `addMediaProcessJob`
(`enqueueMediaProcess` now wraps it). Only newly hosted sources are queued (mapped ones, and
re-runs, are not), dry runs download and queue nothing, video stays `ready` and unqueued, and
a queue failure becomes an import issue with the row left `processing` for the backfill.
Developer docs: Building, "Image pipeline", "Shopify imports".

