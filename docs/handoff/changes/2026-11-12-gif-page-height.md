# Animated GIFs keep their real height (#1545)

- `processAnimatedGif` (`packages/core/src/media/pipeline.ts`) recorded `meta.height`, which for an
  animated image is every frame stacked: a 320×240 GIF with 6 frames was stored as 320×1440. It
  now records `meta.pageHeight` (one frame), falling back to `height` for a single page.
- New test builds a real 3-frame GIF and checks 32×24 is recorded (it failed with 72 before).
- GIFs uploaded before this fix keep their wrong stored height until re-processed
  (`media:reprocess`); their images still display, only reserved space / aspect ratio is off.
