# Email builder: image size and shape, product/collection links, per-icon socials, image upload

Issues #1025 and #1026, plus owner feedback on 3 Nov 2026.

- Visual builder (`grapes-config.ts` `addFriendlyTraits`): clicking an image, button or social icon
  opens its settings. Images get Width presets, Shape (Original, Square, 4:3, 16:9, 4:5), Corners
  and Align; images and buttons get "Link to a product or collection" (`builder-link-dialog.tsx`,
  the Browse picker, writes `{shop_url}/products/…` or `/collections/…`). Social icons list each
  network as a direct-profile link (`-noshare`), so every icon has its own network and link.
- Shapes set a fixed height with class `k-fit`; `compileEmailDesign` adds an inlined
  `object-fit: cover` rule (`withShapeStyle`) so the photo crops instead of stretching
  (Outlook desktop ignores object-fit).
- Block composer: the image block picks or uploads from the media library (`email-image-field.tsx`)
  instead of only a pasted URL, with a preview.
