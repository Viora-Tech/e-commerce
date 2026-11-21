-- A video's smaller copy (owner 17-18 Nov 2026: Waimers' hero videos were 16-34 MB and took
-- seconds to start). The worker re-encodes each uploaded video with ffmpeg and stores the copy
-- beside the original; the storefront plays it in place of the original. Nullable and additive,
-- so an older build that never reads them keeps working during a rolling deploy.
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "compact_url" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "compact_key" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "compact_size" integer;
