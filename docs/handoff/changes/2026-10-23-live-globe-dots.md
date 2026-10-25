# Live view globe: cobe-like dots and a usable settings panel

Owner feedback: the Live view globe's dots looked blocky and white, and the Globe settings
popover was cramped with overlapping text.

- `packages/ui/src/globe/webgl/globe-renderer.ts`: new opt-in `GlobeFrame.spriteDots`. cobe's
  evenly spread Fibonacci dots, each drawn as a round anti-aliased sprite measured in screen
  pixels, in the given colour as is (no 4.5x brightness gain, which clamped to white and gave
  hard blocky edges). The Fibonacci lookup gains two extra bits (up to 131071 dots); they are
  never taken below 32768, so the existing cobe look is unchanged. Unset, every existing path
  (solid, dotted rows, `cobeDots`) renders exactly as before; apps/www passes no `spriteDots`.
- `packages/ui/src/globe/webgl/sprite-dots.ts` (+ test): picks the dot count from the globe's
  zoom-1 size (snapped steps) and the dot radius from the spacing.
- Admin Live view (`webgl-globe-canvas.tsx`): dotted land uses sprite dots in the palette's new
  `landDot` colour; new "Dot size" setting (Fine default / Medium / Bold).
- `globe-settings-panel.tsx`: fixed-height popover anchored to the gear, tabs Look / Layers /
  Data / Palette, its own scrolling body, Reset footer, full-width segmented controls, no
  `leading-none` labels (the overlap).
- Settings storage key stays `wc-live-globe-settings-v2`; older saves load with `dotSize: fine`.
