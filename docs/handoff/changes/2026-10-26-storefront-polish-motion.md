# Storefront: error pages, thank-you tick, chat open/close motion

- **Error pages.** The storefront had no `error.tsx` or `global-error.tsx`, so a failing page
  showed Next's bare default ("This page couldn't load"). New:
  - `app/-s/[storeId]/error.tsx`: a failed page inside the store's header and footer, in the
    theme (`.btn` buttons, theme tokens, light/dark from the theme).
  - `app/-s/[storeId]/checkout/error.tsx`: the checkout's palette (`.ck`, the store's --ck-*
    branding), store logo header, "Back to cart".
  - `app/global-error.tsx`: the store layout itself failed. Own `<html>`, imports globals.css,
    `.ck` palette that follows the OS light/dark setting.
  - All three render `components/errors/error-screen.tsx`: headline + one line, **Try again**
    (Next 16.4's `retry()`, which refetches and re-renders the segment; `reset()` only re-renders
    without refetching), the way out (home page / cart), "Need help? WhatsApp us" (or Email us)
    and the error reference (digest). Entrance: 8px rise + fade, 240ms, strong ease-out; fade only
    with reduced motion.
  - Store name, logo, checkout colours and contact links come from `lib/error-help-actions.ts`
    (`errorHelpAction`, store from `x-store-id`, cached with `storeRead`). Null when the read fails
    (likely the reason the page failed), and the page still reads well.
  - `app/not-found.tsx` (paths outside any store): restyled to the same card. The store's own 404
    is still the theme's `not_found` template.
  - Copy: `data/errors.ts`. Shared constants: `lib/error-page.ts`.
- **Thank-you tick** (`components/checkout/status-mark.tsx`, `thank-you.tsx`, `thank-you-card.tsx`):
  circle 0.9 -> 1 with opacity (200ms), then the tick draws (`stroke-dashoffset` on a
  `pathLength=1` path, 140ms delay, 260ms: 400ms total), then the order number + headline and the
  two cards rise 8px with a fade (260ms) at 140 / 190 / 240ms. Reduced motion: no scale or draw,
  fades only. CSS animations, so they play once on mount and never on re-render.
- **Chat open/close** (`components/inbox/chat-widget.tsx`, `inbox-launcher.tsx`): desktop card
  grows from the launcher's corner (scale 0.96 + 8px + opacity, 220ms open / 160ms close, strong
  ease-out); phone full-screen card slides up from the bottom (`translateY(100%)`,
  `--duration-drawer` with `--ease-drawer`, 245ms back down). Stays mounted, CSS transitions
  (retarget mid-way), `@starting-style` for the first open. Transforms are `motion-safe`, so
  reduced motion is opacity only. Every motion utility is `!` so imported Liquid theme CSS
  (unlayered) cannot cancel it. Launcher icons cross-fade with a 20deg turn + 0.9 scale (plain
  cross-fade with reduced motion); press scale 0.97 now `!` too.
- Keyframes `ck-draw`, `sf-rise`, `sf-fade` sit next to `ck-settle` in `app/globals.css`.
- Not browser-checked by the author (no dev server on the low-RAM PC): check the three error
  pages (throw in a page, in checkout, in the store layout), the thank-you page, and the chat on
  desktop + phone, under our theme and an imported Liquid theme, with and without reduced motion.

## Follow-up: live phone bugs on waimers.koomerce.app (Glide Liquid theme)

- **Chat button under a theme's bottom bar.** Glide's mobile dock (and our own Zero Drift dock,
  `position: fixed`, z-index 45 vs the launcher's 40) covered the chat button on phones.
  `lib/launcher-lift.ts` (pure `launcherLift`/`isOverlay`, tested in `launcher-lift.test.ts`)
  samples `elementsFromPoint` along the window's bottom edge under the button, finds fixed/sticky
  ancestors pinned to the bottom (within 32px, at most half the window tall, overlapping the
  button's column) and lifts the button just above the tallest (`launcherBottom`: the merchant's
  height + safe area, or the bar's top + 0.75rem, whichever is higher). Re-measured on mount,
  after 1.5s, on `load`, on resize and on DOM changes (MutationObserver, rAF-throttled). The chat
  card's `--chat-bottom` follows the same lift. Launcher z-index 999 (`!`), hidden while a tall
  theme overlay (an open cart drawer) sits over its spot so it never covers the drawer's buttons.
  The open card is z-index 2147483000, so the phone's full-screen chat is above any dock. The chat
  roots carry `data-chat-root` so the scan skips them.
- **Cookie banner tall empty sheet on phones.** Ours (`packages/blocks` Zero Drift cookie banner;
  Glide's Liquid banner uses the same classes and stylesheet origin). In a column card (every
  card on a phone, and both corner cards on desktop) `.cookie-banner__copy { flex: 1 1 20rem }`
  made 20rem a height: a blank gap above the buttons. Copy and preferences panel now
  `flex: 0 0 auto` there, with heavier selectors so the imported theme's own unlayered copy of
  the original rule loses too (`section-cookie-banner.css`).
