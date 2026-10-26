# Editor: invisible theme layers no longer swallow canvas clicks

- `apps/admin/src/lib/customize-canvas-interaction.ts`: `sectionUnder` also reroutes a click that
  lands on a section's own see-through layer (opacity 0 or `visibility: hidden` up to the section),
  skipping that section. Found on Waimers' Glide theme: design mode un-hides the signup popup, the
  theme script that closes it never runs in the canvas, so its transparent backdrop covered the home
  page and every click selected "Signup popup".
- `block-toolbar-bar.tsx`: toolbar icons use `text-foreground/80` instead of `text-muted-foreground`,
  so they stay readable on the glass bar over dark hero images.
- Test: `customize-canvas-interaction.test.ts` covers the backdrop case.
