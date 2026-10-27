# Files: new uploads show straight away, tiles load small copies (#811)

## What staff saw
"After files get uploaded the file/photo/video doesn't show up" in Content → Files.

## Real causes
1. **A new image disappeared after upload.** `confirmUpload` sets an image to `processing`
   (the worker then optimises it), but the library listing (`libraryWhere`) showed `ready`
   rows only. The grid re-read the list as soon as the upload finished, the uploading tile
   went away, and the new image was not in the list until the worker got to it (seconds to
   minutes, longer behind an import backlog; never if processing failed). Videos go
   straight to `ready`, so they were not affected by this.
2. **Every tile loaded the original file.** The grid used `item.url` for each of up to 100
   tiles. Live check on cdn.koomerce.app: a product PNG original is 3.2 MB
   (`cf-cache-status: DYNAMIC`, no `Cache-Control`), its 320px WebP copy is 5.6 KB. A page
   of 100 originals is hundreds of MB, so tiles stayed grey for a long time.
3. **Video uploads showed a broken image while uploading**: the pending tile used `<img>`
   for the local preview of an MP4.

## Screenshot artefacts (not what users saw)
The bug report screenshot shows every tile blank, and video tiles with a bar along the
bottom. The CDN answers with `Access-Control-Allow-Origin` only when the request has an
`Origin` header (checked: `Vary: Origin`), and the screenshot library draws `<video>` and
cross-origin images through a canvas, so they come out blank. The bar is most likely how the
capture draws a `<video>` element: the live tiles render `<video>` without `controls`, so
there is no progress bar on the page. MP4s on the
CDN are fine for browsers: H.264, `moov` at the start, range requests return 206.

## Fix
- `packages/core/src/media/service.ts`: `libraryWhere` lists `processing` and `ready`
  (`USABLE_MEDIA_STATUSES`, now in `usage.ts`). `libraryColumns` includes `status`.
  `mediaUsage` counts the same rows so the summary matches the grid.
- `apps/admin/src/components/media/tile-sources.ts`: `tileImageUrls` (640px WebP copy, then
  the original) and `videoPreviewUrl` (`#t=0.1` so a first frame paints). Unit tests next
  to it.
- `media-tile-preview.tsx` (new): tries each URL in turn and ends on "Can't show this
  file" with the file name (same pattern as the product gallery tile from #812). Images are
  `loading="lazy"`. Videos are `preload="metadata"`.
- `media-tile.tsx`: uses the preview and shows an "Optimising" chip on `processing` images.
- `media-library.tsx`: re-reads the page every 5s while a file on it is still optimising,
  so the tile switches to the small copy. The pending tile shows a video preview for MP4s.
- `media-file-rows.tsx` (list view): 320px copy for the thumbnail, video preview while
  uploading.

## Tests
- `packages/core/src/media/service.test.ts` and `packages/api/test/media.test.ts`: a
  confirmed image is listed as `processing`, and a `failed` one is not.
- `apps/admin/src/components/media/tile-sources.test.ts`.
