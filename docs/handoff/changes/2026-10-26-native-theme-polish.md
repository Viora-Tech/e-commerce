# Built-in theme: a new store no longer looks broken (2026-10-26)

What a brand-new store (Claw Gears) showed on its built-in theme, fixed:

- **Hero without a photo** (`section-hero-carousel.css`): white type on the light "dark band" field (that field flips light in dark mode on purpose), and the CTA hanging left under a centred heading. A flat slide's type now follows its field colour, and the flat layout's centring wins over the base `.hero-carousel__content` rule.
- **Header with no links** (`-s/[storeId]/layout.tsx` `menuLinks`): a store with no main menu at all gets Shopify's starter — Shop all + its first 4 collections. A menu the merchant emptied stays empty.
- **Footer with nothing in it**: with no footer menu set, two starter columns — Shop (Shop all + collections) and Help (Search, Track your order, Your account).
- **Products without photos** were black boxes, which also made the home product section look empty: `ProductImagePlaceholder` (bag outline on a faint surface) on product cards and the product page gallery.
- **Newsletter twice**: the default footer no longer repeats the Newsletter section's form (`showNewsletter: false` in `templates-data.ts`; stored templates keep theirs).
