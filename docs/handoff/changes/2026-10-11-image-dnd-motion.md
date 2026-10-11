# Image drag-and-drop motion

One shared feel for every image drag in the admin, in `apps/admin/src/hooks/use-image-dnd.ts`
(constants, `useImageDnd`, `useLiveOrder`) and `components/media/image-drag-overlay.tsx`.

- Product gallery (`product-image-card.tsx`, `product-image-tile.tsx`): dnd-kit still picks up
  (mouse after 4px, touch after a 200ms hold, keyboard on the grip). The card keeps a preview
  order while a tile is carried, so neighbours glide to where it would land on a Motion layout
  spring (no jitter at row wraps, including the double-size main image). The carried image
  rides a `DragOverlay` (scale 1.04, 1.5 degree tilt, shadow on its own opacity layer); its
  slot is a dashed outline. Drop settles in 240ms, shadow fades, tilt returns. Escape restores.
- File drop on the gallery: the zone scales 0.98 to 1, dashed primary border, blurred tint,
  upload icon and "Drop to upload". Uploading tiles fade and scale in (0.94 to 1) and glide in
  the grid; their progress bar is a `scaleX`, not a width.
- Media grid (`media-grid.tsx`, `media-tile.tsx`, new `media-sortable-tile.tsx`): moved from
  native HTML5 drag to the same dnd-kit setup. `MediaGrid` is not mounted anywhere yet.
- Theme Media rail (`media-panel.tsx`): library tiles still drag natively (the drop lands in the
  canvas iframe). The drag image is now lifted (same scale, tilt, shadow) via
  `lib/image-drag-ghost.ts`, the source tile shows a dashed slot, and the upload zone scales to
  1.02 with an icon and "Drop to upload".
- Add-section tiles (`section-picture.tsx`): press scales the picture to 0.97 (Puck owns that drag).
- Reduced motion: no scale, tilt, spring, layout glide or drop animation; opacity only.
