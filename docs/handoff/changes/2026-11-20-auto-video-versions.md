# Automatic small video versions

Roadmap item, 20 Nov 2026. #1783 made a smaller copy of each uploaded video but queued it on the
image queue, held the whole video in the worker's memory, and left imported and older videos to
`bun run media:videos`. Now every video gets its copy in the background, safely.

- **Own queue, one at a time**: `{media}-video` (`MEDIA_VIDEO_QUEUE`, `mediaVideoQueue`), worker
  `apps/worker/src/media-video.ts` with concurrency 1 and BullMQ global concurrency 1 (also
  across an old and a new container during a deploy). Memory guard label `media-video` is in the
  bulk set, so it pauses first. A `video` job still on `{media}-process` from an older admin is
  moved to the new queue, not run there.
- **Streams, never buffers**: new optional `StorageProvider.getStream` (S3/R2 with a 15-minute
  deadline, local disk, memory) and `putStream` on local disk. The worker downloads to a temp
  file, ffmpeg encodes file to file (`apps/worker/src/video-ffmpeg.ts`, node `spawn`, nice 10,
  output capped at 64 KB), then uploads from disk. ffmpeg settings are unchanged from #1783.
- **Skips small videos**: under 4 MB by `head` (no download), or at or under 2.5 Mbps and no
  wider than 1920 by ffprobe, or a copy not 20% smaller. Marked `compact_size = 0` (no
  migration for the column; it existed). A job that fails both attempts is marked the same, so
  the sweep does not retry a broken file every hour.
- **Backfill**: sweep `media-video-backfill`, hourly, on the shared sweeps queue. Uses
  `stores_with_videos_needing_copy()` (SECURITY DEFINER, migration
  `0258_media_video_backfill.sql`, with a partial index) and queues up to 50 videos per store per
  run at a lower priority than uploads. Once every video has been looked at, it finds nothing.
  `bun run media:videos` stays for by-hand runs; new `--force` (with `--store`) redoes a store.
- **Storefront**: built-in (Puck) sections now play the copy too (`collectVideoUrls` /
  `withSmallVideos` in `section-images.ts`, looked up in `attachImageMedia`), and the product
  gallery plays `compactUrl` (`videoSrc` in `product-gallery-lightbox.tsx`); `url` stays the
  key that variant images match on. Liquid sections were already covered by #1783.
- **Not changed**: product cards (they never play video), the ffmpeg binary in the image.

Checks before release: migration 0258 must apply after 0257 (renumber at merge if another
lands first). `ffprobe` ships in Alpine's `ffmpeg` package already installed by #1783.
Memory note: ffmpeg's own memory (about 200 MB for a 1080p encode) is outside the worker's RSS,
which the guard measures, but inside the container limit; with one encode at a time that is
the same peak #1783 had.
