# Coloured halo around product photos on collection grids

`Picture` drew the ThumbHash blur as the `<img>` background; it stays under the loaded image, so a transparent product cut-out (most Waimers PNGs) showed it through as a glow. `blurStyle` now skips the placeholder when the hash has alpha or the original is PNG/WebP/GIF/SVG. Test in `packages/blocks/test/performance.test.tsx`.
