# Posters for older videos and built-in video sections (16 Nov 2026)

- Storefront: a built-in Video, Video hero or hero slide whose cover image was left empty now
  shows the video's poster from Files (`postersByVideoUrl` + `withVideoPosters` in
  `apps/storefront/src/lib/`), looked up with the section images and cached the same way.
- Admin: Files -> a video -> More actions -> "Make poster from video" makes a poster for a video
  uploaded before posters were made on upload (same frame grab as #1758: about 2 s in, not black).
