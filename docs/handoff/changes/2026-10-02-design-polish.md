# Design polish: one motion system, press feedback, mobile-native fixes

**Branch** `fix/design-polish` from `main`. No migration. Motion and interaction styling only:
no layout, copy or component API changes. Rules: `docs/conventions.md`, "Motion".

- **Tokens, defined once per app with the same values.** Admin: `packages/ui/src/styles.css`
  (`--ease-out`, `--ease-in-out`, `--ease-drawer` in `@theme`, so the Tailwind `ease-out` /
  `ease-in-out` classes now use the strong curves; durations and `--motion-*` scales in `:root`).
  Storefront: top of `packages/blocks/src/styles/base.css`.
- **Shared utilities (admin)**: `motion-popup` (popover, menu, submenu, select, combobox),
  `motion-tooltip`, `motion-dialog`, `motion-backdrop`, `motion-press`. Base UI
  starting/ending styles with CSS transitions instead of tw-animate keyframes; popups scale from
  `--transform-origin`, dialogs stay centred, exits run at 70% of the entry time.
- **Press feedback**: `<Button>` and `<Toggle>` scale to 0.97 on `:active` (140ms ease-out,
  never when disabled or a menu trigger); admin link cards and tiles use `motion-press`; storefront
  `.btn`, `[data-icon-close]` and `.product-card__link` press. The `.btn` colour transition now
  reads `--btn-colour-time/-ease`, so the 3s cursor-fill re-timing no longer slows the press.
- **Hover only with a mouse**: both apps override Tailwind's `hover:` variant to
  `(hover: hover) and (pointer: fine)`. Theme CSS: `.btn`, `[data-icon-close]`, product card and
  icon micro-motion hovers are gated the same way (focus-visible unchanged).
- **Tooltips**: `MotionProvider` (`apps/admin/src/components/layout/motion-provider.tsx`, in the
  root layout) puts every tooltip under one `TooltipProvider` (400ms first delay, then instant) and
  sets `MotionConfig reducedMotion="user"` for all Motion components.
- **Reduced motion**: one rule per app zeroes the press/pop/sheet movement tokens; fades stay.
- **Mobile**: storefront root layout exports `viewport` (`viewportFit: 'cover'`,
  `interactiveWidget: 'resizes-content'`), which makes the existing `env(safe-area-inset-*)` in
  the mobile dock and cookie banner real; added to sticky add-to-cart, cart drawer footer, mobile
  menu drawer and `--page-margin`. Inputs 16px on touch screens (both apps), `touch-action:
  manipulation` on controls, `overscroll-behavior: contain` on cart drawer, search overlay, menu
  drawer and offer modal, product overview spin stage `100vh` to `100svh`.
- **ease-in removed**: `--btn-fill-out-ease`, `--icon-close-fill-out-ease`,
  `--icon-motion-out-ease` and the product specs collapse now use `--ease-out` (comments updated).

**Left for a second pass**
- `apps/admin/src/lib/customize-canvas-motion.ts` (section collapse uses `ease-in`) and anything
  under `apps/admin/src/components/themes/**`: theme editor work is in flight.
- Section stylesheets in `packages/blocks/src/styles/section-*.css` still have ~150 ungated
  `:hover` rules (header, footer, hero, social wall, tabbed products...). Do them after the theme
  import build lands, section by section, with the same `(hover: hover) and (pointer: fine)` wrap.
- Checkout (`apps/storefront/src/components/checkout/**`, sticky Pay bar): owned by PR #232.
- Admin `viewport-fit=cover` not set (no fixed bottom bars that need it yet); per-scheme
  `theme-color` for the storefront needs the store layout (theme import owns it).
