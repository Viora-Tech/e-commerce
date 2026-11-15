# Theme picture: imported themes get one again, blank pictures are never shown

Seen on Waimers (15 Nov): the live imported theme "Zero Drift" showed a white picture on the Themes
page. Its stored thumbnail (640 × 400, every pixel white) dated from 21 Oct, before blank pictures
were caught, and was never replaced although the theme was opened and saved in Customize since.

**Root cause.** The theme's hero slides are `<video preload="none">` with `<source>` children.
modern-screenshot 4.7 clones a video with `cloneNode(false)` plus `src = currentSrc` and then waits
for `loadeddata` with no time limit; a `preload="none"` clone never loads, so `domToWebp` never
settled. Customize's capture (on open and after Save) hung silently, nothing was sent, and the old
blank picture stayed. Reproduced with Playwright on the theme's script-free home page in a
same-origin `iframe#preview-frame`: the old capture was still pending after 60 s, the fixed one
returns a picture in about 7 s. Secondary: the worker's server screenshot fallback is off in
production (worker image built without `THEME_SCREENSHOTS=1`, 384 MB limit), so nothing else
replaced it.

**Fix.**
- `capture-theme-thumbnail.ts`: videos are left out of the clone; each video's poster is drawn in
  its place (`stillPosters`); each attempt is capped at 30 s (`withinTime`) and logged when it fails
  or comes out blank.
- `use-theme-thumbnail.ts`: when the stored picture is blank and the retake fails, it is forgotten
  (`themes.thumbnail` with `image: null` sets `thumbnail_url` to null and queues the worker
  screenshot). Failures are logged with `console.warn`, never toasted.
- `use-shown-picture.ts`: the Themes page (live card and library rows) checks the stored picture and
  shows the placeholder swatch when it is blank.
- `setThemeThumbnail` takes `null`.

**Left.** Enabling the worker's Chromium screenshots in production needs the `THEME_SCREENSHOTS=1`
build arg and the worker's memory raised to 768 MB (owner decision). The bug report capture
(`capture-page.ts`) uses the same library and would hang on an admin page with a `preload="none"`
video (none today).
