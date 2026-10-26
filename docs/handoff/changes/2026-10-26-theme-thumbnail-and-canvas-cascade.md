# Theme pictures: no blank pictures saved; Figma restyles kept off imported themes

Branch `feat/themes-2026-10-26`. Found on Waimers (imported Shopify theme Glide).

## Themes page picture was a blank white rectangle

`apps/admin/src/lib/capture-theme-thumbnail.ts` "succeeded" with a flat picture.
- New `apps/admin/src/lib/blank-image.ts`: `isBlankPixels` (≥ 99.5% of pixels within a small
  distance of the most common colour; transparency over white) and `isBlankImage(url)`, which
  shrinks the picture to 64 px across on an (Offscreen)canvas and checks it.
- Capture rejects a blank picture, then retries once lighter: waits for `document.fonts.ready`
  and two paints, skips font embedding (`font: false`), shorter resource timeout, forces the cloned
  page `visibility: visible; opacity: 1` (themes that hide the body until their script runs). Still
  blank, nothing is uploaded and the card keeps its placeholder.
- `use-theme-thumbnail.ts` now takes the stored `picture` URL: when Customize opens on the saved
  home page it retakes the picture if there is none **or the stored one is blank** (read from
  cdn.koomerce.app, which sends CORS for the admin origin). Waimers' Glide gets a new picture the
  next time its editor is opened.

## Glide's hero arrows bunched on the left (editor AND live Koomerce storefront)

Not a cascade-layer problem: the live Koomerce storefront showed the same bug (only the old
Shopify site had arrows at both edges). Our block CSS (`@commerce/blocks/styles.css`) loads on
every storefront page and is mirrored into the canvas; Glide shares Zero Drift's class names. The
"Figma storefront slideshow hero" restyle set `.hero-carousel__control--next { right: auto;
left: calc(var(--page-margin) + 56px) }`; Glide sets only `right`, so our `left` won in both places.
Layering cannot fix a property the theme never sets.

Fix: every rule in the "Figma storefront …" restyle blocks now carries the existing guard
`:not(:where(.shopify-section *))` (convention in `packages/blocks/src/styles/index.css`), in
section-hero-carousel, header, footer, announcement, cookie-banner and mobile-dock. Our own
sections are unchanged; imported Liquid sections no longer get these restyles (Waimers' header,
footer, announcement bar and mobile dock may look slightly different — now as the theme wrote them).
`packages/blocks/test/figma-overrides-scoped.test.ts` fails on any unguarded rule after such a banner.

## Check in a real browser

- Waimers editor: hero arrows at both edges; open the editor, wait ~3 s, Themes page shows a real picture.
- waimers.koomerce.app after deploy: hero arrows, header, footer, announcement, mobile dock look right.
- A native (Zero Drift) store: header/footer/hero still in the Figma look.
