# Shopify video import: hero carousel videos (2026-10-11)

After importing Waimers, everything came over except the home hero carousel videos. No single break reproduced offline (the live page and the theme's Liquid were checked against the code); these links were wrong or missing and are fixed together:

- Data import (`plugin-shopify-import`): a video now copies the tallest mp4 up to 1080p (never the 4K original), a 720p-or-smaller copy for phones, and Shopify's preview picture as the poster. They are recorded by the video's file name (`file_name`, `file_mobile`, `file_poster` mappings). The preview lists each video with its size.
- Theme import (`core/theme-import`): file names match loosely (spaces, `_`, `-`, case, `%20`), so `Keyboard Bento.mp4` finds `Keyboard_Bento.mp4`. A hit brings its poster and phone copy. The live-page fallback keeps the main file (no `media` query) instead of the first `<source>` (which was the phone one) and copies the phone one too.
- Rendering: `VideoDrop.sources` lists 1080 and 720 renditions so the hero's own phone/desktop logic works; `video_tag` and `media_tag` print every `<source>` (phone one with `media="(max-width: 749px)"`), poster and flags.
- Customize: the `video` setting had no editor field and showed as a text box over an object; it is now an object field (url, mobileUrl, poster).

No migrations. Re-run the Files import once to backfill posters and phone copies for older imports.
