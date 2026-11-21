# Smaller video copies

Owner, 17-18 Nov 2026: Waimers' hero videos (16-34 MB straight from the export) took seconds to
start on the live site. Every uploaded video now gets one smaller copy, which the storefront plays.

- **Worker** (`apps/worker/src/video-compact.ts`): ffmpeg re-encodes the original to H.264, at most
  1080p, CRF 26 capped near 3.5 Mbps, AAC 96 kbps, `+faststart`. Runs on the media queue under the
  job name `video` (job id `<mediaId>-video`), outside any transaction. A copy that is not at
  least 20% smaller is dropped. A failed job never touches the original (the image job's failure
  handler deletes its unprocessed object; the video path returns before that).
- **Data**: `media.compact_url`, `compact_key`, `compact_size` (migration `0253_media_compact_video.sql`,
  hand-written). Deleting a video deletes its copy too (`deleteMedia`).
- **Queueing**: `media.confirm` queues the job for MP4/MOV/WebM uploads (`enqueueCompactVideo`).
  Older videos: `bun run media:videos [--store <slug>]` (one at a time, re-runnable).
- **Storefront**: imported (Liquid) theme sections swap each `<video>`/`<source>` `src` that has a
  copy for the copy at render time (`compactVideosByUrl` + `withCompactVideos` in
  `apps/storefront/src/lib/liquid-theme.ts`), before the section is cached. A section rendered and
  cached before its copy existed plays the original until that cache entry expires.
- **Image**: the worker image adds Alpine's `ffmpeg` (about 60-80 MB). `FFMPEG_PATH` overrides the
  binary. Two encode threads, about 200 MB beside the worker while a video encodes.
- Not covered yet: our own (Puck) theme sections and product-page videos still play the original.
