-- Automatic small video copies (worker `media-video-backfill`, 20 Nov 2026): the hourly sweep
-- finds stores with a video in Files that was never looked at for a copy. `compact_size` null
-- means not looked at yet; 0 means looked at and the original kept (see `NO_COPY_SIZE` in
-- `packages/core/src/media/compact-video.ts`). Ids only, under SECURITY DEFINER like the
-- other `stores_with_*` sweeps. Videos younger than 15 minutes are left to their upload's job.
CREATE INDEX IF NOT EXISTS "media_video_needs_copy_idx" ON "media" ("store_id")
  WHERE "compact_size" IS NULL AND "key" IS NOT NULL
    AND "content_type" IN ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_videos_needing_copy() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT m.store_id FROM media m
  WHERE m.compact_size IS NULL AND m.key IS NOT NULL
    AND m.content_type IN ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v')
    AND m.created_at < now() - interval '15 minutes';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_videos_needing_copy() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_videos_needing_copy() TO app;
