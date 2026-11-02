# Email builder: fixes from the browser test

Found while testing the visual builder in Chrome (3 Nov 2026):

- **Image shapes in columns.** Square / 4:3 / 16:9 / 4:5 set the height from the full email width
  (552px), so an image in a 3-column row became a tall strip. The height now uses the width the
  image is drawn at on the canvas (its own width when set). `grapes-config.ts` `shapeWidth`.
- **Link picker picks one.** "Link to a product or collection" used the multi-pick list with
  "Select all shown". `ResourcePickDialog` gained `single`: a tick replaces the last pick and the
  select-all row is hidden. Used by `builder-link-dialog.tsx`.
- **Gallery thumbnails.** The 600px preview was drawn at 40% with a scrollbar and a grey gap below.
  Now 42%, centred, as tall as the card, no scrolling.
