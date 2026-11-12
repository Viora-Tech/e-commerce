# Pre-order campaign page: a limit box for every variant (12 Nov 2026)

The owner wanted to type each variant's pre-order limit in one place, on the campaign page,
instead of opening every variant. Follows #1537 (per-variant limits: "per-variant only; the
product/campaign limit is the default a blank variant uses").

- **Single source of truth.** The limit is still `variant.preorder_override.limit` (jsonb), the
  key the variant page edits. No new column, no migration.
- **Core.** New `packages/core/src/preorder/campaign-variants.ts`:
  `campaignVariants(ctx, productIds)` (live variants with title, SKU and own limit) and
  `setCampaignVariantLimits(tx, campaignId, limits)` (writes with `withPreorderLimit`, keeping the
  override's other keys such as `enabled: false`; only variants of products in that campaign
  change, others are skipped). `PreorderCampaignCreateSchema` / `UpdateSchema` take
  `variantLimits: { variantId, limit: 1..1,000,000 | null }[]` (null clears; update omits = leave
  as is). Create/update call it in the same transaction as the rest of the campaign save.
- **API.** `preorders.campaigns.variants({ productIds })` (Products read) lists the variants; the
  limits ride on the existing `create`/`update` (Products write). No extra client calls per variant.
- **Admin.** `campaign-members-card.tsx` loads the variants of the picked products (saved ones and
  ones just picked) and, under each product, `campaign-variant-limits.tsx` shows a collapsed
  "Variant limits (n)" list: variant title, SKU, a numeric box. Only variants that take pre-orders
  in the campaign (all, or the picked ones) are listed. The placeholder shows what a blank uses:
  "20 (product's)", else "50 (campaign's)", else "No limit", live as the other boxes change.
  The form keeps only the boxes typed since the last save (`CampaignFormState.variantLimits`), so
  untouched variants are never rewritten.
- **Validation.** Blank = inherit (null). Whole numbers 1 to 1,000,000, the variant page's own
  rule (`validVariantLimit`, catalog schema `min(1)`), checked in `toCampaignInput` and by zod.
  Zero is refused so the variant page never loads a value it would itself reject; "no pre-orders
  for this variant" stays the variant's "Allow pre-order" switch / leaving it unpicked.
- **Copy.** `data/preorders.ts` + `data/hi/preorders.ts`: `variantLimits`, `variantLimit`,
  `fromProduct`, `fromCampaign`, `noLimit`, `loadingVariants`; reworded `perProductHelp`,
  `limitHelp`, `badNumber`.
- **Docs.** Merchant guide `products/pre-orders.mdx`, "Every variant's limit from the campaign page".
- **Tests.** `packages/core/src/preorder/campaign-variants.test.ts` (DB: create/update/clear,
  other override keys kept, outside variants skipped, schema bounds);
  `apps/admin/src/components/preorders/campaign-form-state.test.ts`.
