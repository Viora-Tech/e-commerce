# Live globe: smaller, calmer order dots (#1448)

- `packages/ui/src/globe/webgl/overlay-points.ts` (Live view): order dots 0.022 of the radius
  (was 0.056), newest 0.034 with a gentle 85–100% pulse (was up to 0.11, 60–100%). Big-order
  size spread and glow toned down (glow 1.9×, 30% brightness).
- `live-globe-canvas.tsx` (Home card, cobe units): 0.018 / newest 0.027 to match.
