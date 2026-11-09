# Customize preview: theme dark mode, not the admin's (#1413)

**What changed**

- New `apps/admin/src/lib/customize-preview-root.ts`: holds the canvas iframe's `<html>` to the
  preview mode. It drops the admin's next-themes `light`/`dark` class (unless the theme's own
  `<html>` carries it), keeps the imported theme's own `<html>` classes, stamps `data-theme` with
  the toolbar's mode and, for imported themes, the inline `color-scheme` their toggle script sets.
  A MutationObserver re-applies it after Puck's AutoFrame copies the admin's `<html>` attributes in
  (`CopyHostStyles` → `syncAttributes`, which runs after our effects).
- `preview-frame.tsx` installs it for every theme. Before, `data-theme` was set only for our own
  themes; an imported theme's effect returned early, and its own `theme-toggle.js` never runs in
  the canvas (scripts inserted through `innerHTML` do not execute), so the Light/Dark button did
  nothing there.
- `customize-editor.tsx`: the preview opens in the theme's `darkMode.default` (`system` follows
  the device's `prefers-color-scheme`) until the button is clicked; the pick then sticks across
  template switches and canvas reloads.

**Not changed: cookie banner over the form.** Separate cause, not the class leak. On an imported
theme the theme's own Liquid cookie banner (`<cookie-banner class="cookie-banner--bar">` in the
footer group) renders in the canvas `position: fixed` with its `cookie-banner-in` fade, so it sits
over the page. Its section wrapper gets `data-canvas-offscreen` when the footer is out of view,
and `OFFSCREEN_PAUSE_CSS` freezes that fade, so it can stop part way (see-through). Our own React
banner is drawn static in the canvas (`cookie-banner--static`); the Liquid one is not. Possible
follow-up: draw an imported theme's `.cookie-banner` in page flow with no animation in the canvas.

**Checks**: `customize-preview-root.test.ts` (6 tests), admin typecheck, biome, `lint:components`,
`test:sweeps`.
