# Theme editor: Theme settings and Page settings per Figma (2026-10-11)

Third PR for the owner's "still far from Figma" complaint about Customize. It builds on the panel
heads and inspector from #423.

- **Theme settings** (`theme-panel.tsx`, Figma 369:121884):
  - **Colours:** five swatch rows (Brand, Accent, Background, Text, Buttons) with typed or picked codes.
  - **Typography:** two compact font dropdowns and a Size scale (S / M / L).
  - **Buttons:** Corner radius (Square / Soft / Round), Filled / Outline, and a live sample.
  - **More:** "All colours", "More type settings" and "More button settings" open the existing exact controls, so nothing is lost.
  - **Rows below:** Presets, Logo & favicon, Layout and Product cards as closed rows; Checkout branding links out.
  - **Reset to preset** sits in the head.
  - `lib/theme-quick-settings.ts` maps the simple choices onto theme numbers.
- **Page settings** (rail tab renamed from "Store settings", Figma 381:7763):
  - **Home page:** a real form over the store preferences:
    - SEO title and description with a Google preview, and the social image.
    - Visibility: Published, or the store password (min 4 characters).
    - Its own "Save page settings".
  - **Product, collection, page, blog and blog post templates:** explain that each item has its own listing, and link to the previewed item and the list.
  - **Cart, search and 404:** say they have no listing of their own.
  - **"Store-wide settings":** folds open the old store-settings links.
- **Not built:**
  - Theme settings: Generate palette from logo, and the Cart and Social links rows (the theme has no such settings).
  - Page settings: a Hidden visibility, and editable title and handle for the home page.
- **Still from Figma's list, not built:** Help panel, page switcher popover look, and Save beside Publish (needs the owner's call).
