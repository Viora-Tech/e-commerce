# Theme picture: a header over a flat page counts as blank

Waimers' Themes card showed a dark picture (the header over the hero video's poster, which is
the video's black first frame, copied from Shopify) and sometimes a white one (a page that had
not painted). The blank check judged the whole picture, and the header bar's colour was enough
to pass it.

- `blank-image.ts`: `isBlankImage` is also true when the part below the top quarter
  (`HEADER_SHARE`, `bodyPixels`) is one flat colour. The same check runs before Customize saves a
  picture and on a stored one, so the existing dark picture is replaced by the theme swatch and
  retaken.
- Production has no `THEME_SCREENSHOT_CHROMIUM`, so the worker's headless picture never runs;
  imported themes depend on Customize's in-browser capture.
- Store-side: a hero video slide with a dark first frame should get a Poster image in Customize.
