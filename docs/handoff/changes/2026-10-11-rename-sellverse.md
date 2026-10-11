# Platform renamed: Vextro → Sellverse

- `siteConfig.brand` (packages/config/src/site.ts): name **Sellverse**, domain `sellverse.app`, support, docs,
  legal, status and social URLs on the new name. The domain is not bought/wired yet; the URLs are what
  they will be.
- Admin copy that spelled "Vextro AI" (Analytics, ⌘K palette, Shipments; English + Hindi) now reads
  `${siteConfig.brand.name} AI`, so the next rename is one line.
- Merchant guide pages say Sellverse. Developer docs keep real resource names (`vextro/*` ECR repos,
  `/vextro/deploy/*` SSM, the "Vextro" Figma file).
- Tests updated for the new name.
