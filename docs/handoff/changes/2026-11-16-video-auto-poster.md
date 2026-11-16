# Automatic video posters

Owner, 16 Nov 2026: a video's first frame is often black (Waimers' hero videos showed a dark
poster before playing), so every uploaded video should get a good poster by itself.

- **Upload**: `uploadFile` (`apps/admin/src/lib/upload.ts`) grabs a poster for each video in the
  browser (`lib/video-poster.ts`): the frame at 2 s, else 4, 1, 6, 0.5, 8 s, skipping frames that
  are black or flat (`blank-image.ts` checks); a video dark all through still gets its 2 s frame.
  The JPEG (long edge ≤ 1920 px) is uploaded as its own picture and linked with
  `media.setPoster`. Best effort: a failure leaves the video without a poster, never fails the upload.
- **Data**: `media.poster_media_id` (migration `0250_media_poster.sql`, hand-written like 0235+;
  the drizzle snapshots stop at 0233, so `drizzle-kit generate` drags in unrelated tables).
  Core: `packages/core/src/media/poster.ts` (`setVideoPoster`, `videoPosterByUrl`).
- **Customize**: a theme `video` setting (`{ url, mobileUrl, poster }`) now renders through
  `video-setting-field.tsx`: the poster gets the image picker (it was a raw "Image URL" box),
  and typing or pasting a video address from Files fills an empty poster with that video's poster.
- Not covered: videos uploaded before this change (no poster yet; pick one by hand), and the
  native block sections' own video fields (Waimers uses the imported theme's setting).
