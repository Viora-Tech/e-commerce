# Online store → SEO: score, issues and "Fix with AI"

A new **SEO** tab (Online store → Themes | Preferences | **SEO**, route `/online-store/seo`).

**What it checks.** The rules live in `packages/core/src/seo/checks.ts` (pure); the loader is `seo/service.ts`.
It covers live products, active collections and published pages, up to 5,000 of each.
- **Search title:** missing, over 60 or under 15 characters, duplicated within its kind.
- **Search description:** missing (with no body text to fall back on); over 160 or under 70 characters, judged only
  when the merchant wrote one; duplicated.
- **Products:** no photos, photos without alt text, thin description (under 50 words), no brand (vendor) or
  barcode (GTIN) for Google Shopping.
- **Handles:** not short lowercase-hyphenated words.

**Score:** 100 minus points per issue (high 10, medium 4, low 1), scaled by the number of items checked.

**Fix with AI:**
- One button per gap: search titles and descriptions, alt text, descriptions.
- Each opens the existing bulk Write with AI sheet (`BulkWriteSheet`, new `initialFields` prop) with those
  products preselected, up to 200 per run (the API's BULK_MAX).
- The merchant reviews the changes before Apply, and the page refreshes after.
- Hidden when Write with AI is off.

**API:** `seo.report`, gated with `can(ONLINE_STORE_READ)`.

**Not yet** (the next PRs from the plan):
- site checks: broken links, sitemap coverage, slow pages, missing JSON-LD;
- AI keyword suggestions;
- a Google Search Console app.

Tests: `packages/core/src/seo/checks.test.ts`, written but not run on this branch (run on dev after merge).
