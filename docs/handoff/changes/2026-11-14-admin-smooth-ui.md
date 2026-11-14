# Admin: smooth UI in Chromium on Windows (no backdrop blur, idle globes)

Branch `perf/admin-smooth`. No migration. The owner saw choppy scrolling, menus, drawers and tables
in Brave on Windows. Causes were found by reading the code (no browser here); the fixes keep the
look, apart from the points under "Looks different".

## What changed

- **Backdrop blur gone from the admin** (`packages/ui/src/styles.css`). Chromium redraws a
  `backdrop-filter` on every frame that anything behind it scrolls or moves.
  - `key-primary` (every default `<Button>`, the store tile, Finish setup ticks) had a 12px blur
    behind an opaque fill. Removed; it never showed.
  - `glass-popover` (menus, selects, comboboxes, popovers, the command palette, theme editor
    toolbar, toasts) and `glass-bar` (save bar, role summary bar, Live view cards) are now solid
    `--popover` / `--raised` with no blur. They were 85% and 68–72% fills over a blur.
  - `glass-scrim` (dialog, sheet and alert dialog backdrops) is a tint only; the Drawer backdrop
    (courier and shipment drawers) lost its `backdrop-blur-xs`; toasts lost `backdrop-blur-xl`.
  - The blur and the translucent fills now come from tokens (`--glass-bar`, `--glass-popover`,
    `--glass-*-filter`). They are solid/`none` by default. `apps/www/src/app/globals.css` sets
    the old values, so the marketing site looks the same as before.
- **Globes idle when nobody sees them.** `live-globe-canvas.tsx` (Home) and
  `webgl-globe-canvas.tsx` (Live view) stop their `requestAnimationFrame` loop while scrolled out
  of view (`IntersectionObserver`) as well as in a hidden tab. The Live view globe also stopped
  calling `getComputedStyle` three times per frame: it reads the palette again only when the look
  settings change.
- **Home sales hero.** `hero-glass.tsx` is its own compositor layer (`will-change-transform`), so
  the four 60px blurred blobs are drawn once, not again whenever the chart's hover line or a tile
  repaints above them.
- `transition-all` replaced with named properties in the vendored accordion, input-otp and
  navigation-menu.
- Live view globe controls (`globe-overlay.tsx`, `globe-settings-panel.tsx`) are solid popover
  colour instead of 90–95% plus a blur.
- New `docs/conventions.md` section "Smooth UI" and sweep `scripts/sweeps/smooth-ui.test.ts`
  (`docs/guardrails.md`, aa): no `transition-all`, no backdrop blur on fixed or sticky containers,
  and any other backdrop blur allow-listed per file (four small, short-lived ones today).

## Looks different

- Dialog and sheet backdrops: the page behind is tinted but no longer frosted.
- Live view: the floating cards and the header pill are solid instead of see-through over the
  globe.
- Menus and the save bar no longer let a blurred hint of colour through. Over the usual white
  or dark page this is the same colour as before.

## Checked and left alone

- Shell re-renders: `admin-frame.tsx` sets state only when scrolling crosses 4px (React drops
  same-value updates); locale, region and storage-scope contexts are primitives or compiler-memoised;
  the bell polls once a minute inside itself; the top-bar hint rotates inside `RollingText`.
- Lists are paged (25–100 rows). `content-visibility` does nothing on `<tr>`, so it was not added.
- Muted table rows (`[&>td]:grayscale`) and single-card hover shadows: one row or card at a time.
- Sidebar collapse still animates width (one toggle, rare); Live view globe rendering itself.
