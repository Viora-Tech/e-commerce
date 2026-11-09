# Waimers header: gap from the top, compact on scroll (theme file, not applied)

The floating pill header on www.waimers.in is styled by the live revamp theme's own CSS (the
"Header: a floating glass bar that narrows on scroll" `<style>` block next to its "Tokens" block),
not by repo code: `packages/blocks/src/styles/section-header.css` is only the base header and no
repo file holds the revamp rules. So the change ships as a theme file to add to a copy of the
theme: `docs/themes/waimers-revamp/header-float.css`.

- A 0.75rem gap above the bar, at rest and stuck (was the revamp's 0.5rem gutter).
- Once `.header-wrapper.scrolled-past` is set: a 3rem bar, a 1.25rem logo, tighter padding and
  icon buttons, eased over 280ms (no motion with reduced motion).
- The product gallery and stacked buy rail pin below the bar plus its gap, so the bar no longer
  covers their top.
- Scoped to the revamp's own `html body` selectors and `--rv-*` tokens; other stores and themes
  (Claw Gears on Horizon) are untouched. The live theme was not edited or published; the owner
  applies it to a duplicate, previews, then publishes.
