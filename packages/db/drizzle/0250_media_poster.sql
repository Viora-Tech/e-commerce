-- A video's poster picture (owner 16 Nov 2026: automatic posters, a frame about 2 s in instead of a
-- black first frame). The admin grabs the frame when a video is uploaded and saves it as its own
-- image row; this column links the video to it. Nullable and additive, so an older build that never
-- reads it keeps working during a rolling deploy.
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "poster_media_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "media" ADD CONSTRAINT "media_poster_media_id_media_id_fk" FOREIGN KEY ("poster_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
