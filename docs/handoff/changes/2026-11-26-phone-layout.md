# Phone layout fixes from the live store check (chat button, cart, search, filters, prices)

Branch `fix/phone-layout` (from `origin/dev`). No issue. No migration.

## What changed

- **Chat button on phones** (under 40rem): 2.75rem instead of 3.5rem, 0.75rem off the edge, a
  labelled pill shrinks to its icon. It tucks away while the page scrolls down and comes back on
  scroll up or near the top, and stays hidden while a buying bar is on screen (a shown sticky add
  to cart `.sticky-atc.is-visible`, or anything marked `data-chat-tuck`). Rule:
  `apps/storefront/src/lib/launcher-tuck.ts` (`nextTucked`, `buyingBarShown`), used by
  `components/inbox/inbox-launcher.tsx` and, as plain JS, by `lib/plain-html/chat-module.ts`
  (numbers passed in `chatModuleSpec`, CSS in `chat-launcher.ts`). Both also re-measure the lift
  on `transitionend`, so a sliding sticky add to cart is measured once it has arrived.
- **Cart on phones** (under 750px): a bar with the total and Check out pinned above the mobile
  dock (`cart-checkout-bar` in `app/-s/[storeId]/cart/cart-contents.tsx`); the summary's own
  button hides there. CSS in the new `packages/blocks/src/styles/phone-layout.css` (imported last
  in `shared.css`).
- **Search field**: one box. The live theme's custom CSS gives `.search-page__input` its own
  border, background and 3.25rem height; a two-class rule in `phone-layout.css` outranks it.
- **Card price row on phones**: "Save Rs. N" hidden in cards (it never fit), `phone-layout.css`.
- **Sort menu**: the server now draws the same button the browser shows (`sort-select.tsx`), with
  the plain select form only in `<noscript>`. The select-to-button swap after hydration moved the
  toolbar and grid, a likely part of the 0.133 layout shift on /search.
- **Filters**: chevrons use a named group (`group/filter`), because the phone drawer is an open
  `<details>` too and flipped every chevron. Apply is sticky at the foot of the phone drawer.
  Rows and group headers are 2.75rem tall on phones (`filter-form.tsx`).
- **Price filter top**: `browseProducts` facets now take the dearest variant (`max(max_price)`),
  not the dearest from-price (`packages/core/src/catalog/browse.ts`).
- **Tap targets** on touch screens (`phone-layout.css`, `pointer: coarse`): hero dots, product
  image dots, cart Remove, breadcrumb and announcement links get a transparent 2.75rem-ish hit
  area; nothing visible changes size.
- **Sold-out product**: the "₹X with UPI" offer note hides when the variant cannot be bought
  (`packages/blocks/src/components/product-view.tsx`).

## Tests

- Added `apps/storefront/src/lib/launcher-tuck.test.ts` (scroll rule, plain page CSS and config).
- Added a case to `packages/blocks/test/zero-drift-main-product.test.tsx` (no UPI note sold out).
- Added a case to `packages/core/src/catalog/browse.test.ts` (price range top, database).
- Not run: the worktree has no `node_modules`.

## Left to do / for the owner to check

- Theme data, not code (change in Customize or the theme files, not done here):
  - Hero bar price (Wooting 60HE V2 showed Rs. 22,999, a pre-order variant): the theme's
    `sections/hero-carousel.liquid` prints `product.price` (Shopify's lowest variant price). Use
    `product.selected_or_first_available_variant.price` there to match the grid.
  - "Choose options" on sold-out cards (Blazing Sky ZERO, X1, Saturn Pro T1): the theme's card
    snippet shows the options link for any multi-variant product. Wrap it in
    `{% if card_product.available %}` and show the disabled Sold out button otherwise, as the
    single-variant branch does.
  - Menu drawer close: the live header is the theme's Liquid header, not our `header-drawer.tsx`.
    Its close control is the burger itself (it turns into an X), but the custom CSS
    `html body .header-drawer__panel { top: 0.5rem; left: 0.5rem; ... }` lays the panel over it.
    Add a close button in the drawer head (`snippets` header drawer) wired to `FocusDisclosure`
    `close()` in `assets/header.js`, or move the panel below the header. `aria-expanded`: the
    toggle is a `<summary>`, whose open state browsers already announce; if wanted, set it in
    `FocusDisclosure.onToggle`.
  - The search field: if the owner wants the revamp look (3.25rem, card colour), move the custom
    CSS rule from `.search-page__input` to `.search-page__field`.
- Chat button side: kept at the merchant's setting (bottom-left on Waimers). Customize, Inbox
  chat, Position can move it right, where it sits over the dock's Cart tab instead of Search.
- Check on localhost at 24.4rem: chat tucks on scroll down and on the product page's sticky bar;
  cart bar sits just above the floating dock; filter chevrons; search box; the 0.133 layout shift
  on /search (not measured here; fonts swapping may be the rest of it).
