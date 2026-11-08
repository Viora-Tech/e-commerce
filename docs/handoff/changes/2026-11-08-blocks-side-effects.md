# Blocks: unused sections no longer shipped to every page

`packages/blocks/package.json` now declares `"sideEffects": ["*.css"]`. Storefront components
import from the `@commerce/blocks` front door (`index.ts`); without the flag the bundler had to
keep every module the front door re-exports (all sections, the reviews widgets, Razorpay's EMI
widget, `sanitize-html` with `postcss`), on every page, cart and sign-in included. A test bundle
of `formatPaise`, `StoreActionsProvider`, `trackCommerce` and `useWishlist` from the front door
went from 492 KB to 3.7 KB.

No blocks module runs code when imported (no registrations, globals or bare imports); the
stylesheet entry (`styles.css`) is the one file that must always be kept. If a future blocks
file must run on import, list it in `sideEffects`.
