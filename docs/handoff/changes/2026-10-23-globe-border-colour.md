# Live view globe: border colour

- Globe settings → Look → Colours gets a **Border colour** picker (next to Land, Ocean, Accent).
- Applies to country borders and coastlines, solid and dotted. Unset keeps the original subtle tint.
- `GlobeFrame.line` (optional) in `packages/ui/src/globe/webgl/globe-renderer.ts`; omitted = unchanged look, so the Home globe is unaffected.
- Saved per browser like the other globe settings (`customBorder`).
