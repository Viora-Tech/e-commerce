# Custom WebGL globe

**Custom WebGL globe** (27 September 2026, `feat/webgl-globe`): Analytics → Live view now
draws our own WebGL globe (`apps/admin/src/components/analytics/live-globe/webgl-globe-canvas.tsx`
+ `webgl/`, no three.js, ~6 KB minified engine) instead of cobe. Land dots are placed on the
CPU in full precision from `apps/admin/public/globe/land-2048.png` (same Natural Earth map as
the cobe patch) with four levels of detail (40k to 1.08M sphere points; India ~390 dots with
cobe, ~13k at the top level); zoom goes to 4×. Lazy-loaded with `import()` after the stats
paint. Home card keeps cobe. Both share `globe-controls.ts`, `globe-overlay.tsx`,
`globe-palette.ts`, `types.ts`. Developer docs: `developer-docs/building/live-globe`. Known,
untouched: the cobe card's marker buttons use `projection.ts`, which is 90° off cobe's own
projection, so its hover targets drift from the drawn markers.
