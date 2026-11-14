# Products list, product page and variant page: design pass (page pass 3)

Design audit section 7, page 3 (`/products`, `/products/[id]`, `/products/new`, the variant page).
Visual and state consistency only: every action, field, save and flow is as before. Builds on
wave 2 (product tabs on PillTabs, product sections on Field, KitButton gone), which was checked
and is in place.

## Products list

- A failed read shows "Could not load products" with Try again inside the table, under the
  header (was: no catch, the table kept spinning or showed stale rows). Refreshes after a row
  action, an import or a bulk action land there too when they fail. New copy `loadFailed` (+ Hindi).
- Loading screen: `products-list-skeleton.tsx`, like the Orders one: the real title, three
  header buttons, four stat tiles and the real ResourceTable in its loading state with the
  product columns, so the header labels and column widths do not move.
- Export spins while it runs (was dim only). Bulk bar: Set as active / Set as draft spin on the
  pressed button; More actions uses ActionMenu `buttonSize="sm"` instead of hand classes.
- The bulk "Write with AI" banner lost its extra `mb-4` (it sat 2.5rem above the table, not 1.5rem).
- Add to collection (bulk): the "Loading…" line is a field-shaped skeleton.

## Product page and new product

- Loading screen: `product-page-skeleton.tsx`: the detail shell, header with the photo tile and
  3 buttons (1 for a new product), the underline tab strip, the tab line and cards (was the
  generic 3 + 2 cards with no tabs and no tile).
- Switch rows (Charge tax, tax per variant, physical product, the duplicate dialog) use one
  `products/switch-row.tsx` (moved from `variant-page/`) drawn with Field, FieldContent,
  FieldLabel and FieldDescription; the label stays at body size. Inline switch, checkbox and
  radio labels (unlimited stock, featured, pre-order switches, payment mode, own fields) are
  FieldLabel inside Field. "Featured" and "Tax per variant" now match the other labels
  (was grey / semibold).
- Profit margin line: Alert `tone="success"` (was a hand-made green box), product and variant.
- Cards that hid or lied on a failed read now say so with Try again (LoadFailed inline):
  stock history (showed "no history"), collections (showed an empty picker, so a save could
  drop the product's collections), sales (hid itself; still hides for a role without access).
- AI writer dialog, AI preview picks, SEO suggestions and keyword skeleton: `rounded-xl` →
  `rounded-lg` (the card radius). Error alerts use `tone="danger"`.
- Variant table "no matches" and the variant images dialog's empty box use EmptyState.

## Variant page

- `variant-page-columns.tsx`: the list + cards grid, shared by the page and its new
  `variant-page-skeleton.tsx` (was the generic skeleton with a right-hand side column, while
  the page has the variant list on the left).
- Phone variant picker label is FieldLabel (`sr-only`).

## Shared files touched

- `components/layout/page-header-skeleton.tsx`: new optional `lead` (draws the 3rem tile);
  default unchanged.

## Left alone

- SelectProductsDialog → ResourcePickDialog: not used on these pages (10 callers elsewhere;
  audit step 9e).
- Search Console card still appears only once loaded: most stores do not have the app, so a
  skeleton would flash and vanish.
- Variant metafields: a failed read still hides the card (save stays a no-op), as before.
- The "settings" rail layout of the product tabs keeps its own rail; the skeleton draws the
  default tab strip.
- Variant toolbar's inline "Group by" label and the AI/SEO pick-list rows keep their labels.
