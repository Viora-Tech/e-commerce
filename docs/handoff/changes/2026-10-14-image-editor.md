# Image editor (phase 1): crop, rotate, flip, adjust

**Where:**
- **Product gallery:** a pencil button on each photo (on hover) opens the editor. Saving uploads the edit as a new
  photo and puts it in the original's place: same position, so the main image stays main, and the same alt text.
  The product save stores it.
- **Content → Files:** a tile menu entry, "Edit image". Saving adds an edited copy and leaves the original alone.
- **Not offered for:** videos, SVGs and GIFs (`isEditableImage` in `lib/image-edit.ts`).

**Editor** (`components/media/image-editor-dialog.tsx`):
- Crop with react-easy-crop 5.4.2 (MIT). Shapes: free, square 1:1, portrait 4:5, tall 3:4, banner 16:9. Zoom.
- Rotate left/right and flip sideways/upside down.
- Sliders for brightness, contrast, colour, warmth and sharpen (double-click resets one). "Auto enhance" sets them
  from the photo's own tones. Reset puts everything back.
- One CSS filter string (`adjustFilter`) drives the live preview and the canvas render, so the saved photo matches
  the preview. Sharpening is a light unsharp mask applied on the canvas only.
- Output is JPEG at 0.92, or PNG when the source was PNG, at most 4096 px on the long side. The normal upload pipeline
  then makes the AVIF/WebP sizes.

**Storage note:** the browser has to read the stored photo, so the bucket's CORS rule must allow GET. The rule our
storage check suggests already does. If it doesn't, the editor says so instead of failing silently. The photo
is fetched with a cache-busting query, so a copy cached without CORS headers can't taint the canvas.

**Not yet (phase 2):** background removal, video trim/cover frame, and editing before upload.
