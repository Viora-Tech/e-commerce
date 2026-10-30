# Theme editor AI: pictures, links, long pages; Markets › Rollouts (30 Oct 2026)

- The editor AI can set pictures and links. The page outline now carries our own sections'
  image fields (`image` kind, value is the URL) and button objects (`button.label`,
  `button.href`), and imported sections' `image_picker` settings. New `findImages` tool
  (packages/api/src/services/ai/assistant/find-images.ts) finds the store's products and
  collections by name with their main picture and storefront link. Applying writes pictures as
  `{ url, alt }` (keeps alt, drops the old focal point) and `button.href` into its object
  (`withChange` in apps/admin/src/lib/theme-edit-apply.ts). The card shows image changes as
  before/after thumbnails.
- Outline cap 12,000 → 32,000 characters: on Waimers' long imported home page the lower sections
  lost all their settings, so the AI said the newsletter had "no editable settings".
- Rollouts sits under Markets in the sidebar (Shopify's Markets › Rollouts): `/markets/rollouts`.
  `/rollouts` (live for a few hours) and the old Settings addresses redirect there.
