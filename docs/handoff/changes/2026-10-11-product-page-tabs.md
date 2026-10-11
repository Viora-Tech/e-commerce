# Product page: left column as real tabs, two looks (2026-10-11)

The product edit page showed a tab strip that only scrolled to cards on one long page. The left column is now real tabs; the right column (Status, Organisation, ...) is unchanged.

- One tab list (`product-tab-list.ts`) drives both looks: Media, Details, Pricing, Inventory (single-variant products), Variants, Shipping, Google preview, More. `product-tabs.tsx` renders it as a horizontal strip ("Tabs", default) or a vertical rail like Settings / AppNav ("Settings", a scrolling row on phones).
- Each tab has a one-line description; the selected tab is `?tab=pricing` (pushState, so no server refetch; Back works; unknown values fall back to the first tab).
- One form state in `ProductForm`; panels stay mounted and are `hidden` when inactive, so edits and card-local state survive switching.
- A failed Save puts a dot on each tab with an error and jumps to the first one (`tabsWithErrors`).
- Roles tablist / tab / tabpanel; arrows, Home, End move between tabs.
- Switch: Account > Appearance > "Product page layout" (cookie `admin_product_layout`, read on the server by the product pages).
- Removed: `ProductSectionNav` (scroll anchors) and `ProductMoreSection` (collapsible; More is now a tab, so a pre-order deposit error opens it). Extra fields moved to Details, variant extra fields to Variants. Copy: `productFormContent.tabs`, `appearanceContent.productLayout` (+ Hindi).
- No migrations.
