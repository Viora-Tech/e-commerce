# Customize: canvas zoom (A4)

Branch `feat/builder-zoom`. No migration.

- The canvas lays the page out at the device's real width (1440 / 768 / 390 px) and scales it:
  Fit by default, or 25–200 % from the top bar's "1440 PX / 60 %" readout (`zoom-menu.tsx`,
  values in `lib/customize-zoom.ts`, test `customize-zoom.test.ts`). Desktop used to be "Full
  width" (whatever space was left between the panels), which often showed the tablet layout.
- `customize-layout.tsx` measures the canvas area and scales the frame; `preview-frame.tsx`
  writes `--canvas-zoom` into the canvas; the block toolbar, the "+" line and Puck's outline keep
  their on-screen size (`UNZOOMED`, vendor-puck.css). The "+" spans only the part in view.
- The zoom menu's radio items need `closeOnClick` (Base UI leaves radio menus open otherwise,
  and the open modal menu ate the next click on the canvas).
- Checked at Fit, 25, 50, 100, 150 and 200 %: select, toolbar duplicate, inline edit, the "+"
  insert dialog and dragging a section in from the Add panel.
