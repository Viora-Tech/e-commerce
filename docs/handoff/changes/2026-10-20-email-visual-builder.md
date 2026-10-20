# Campaigns: visual drag-and-drop email builder (GrapesJS + MJML)

Branch `feat/email-visual-builder`. Migration `0140_email_design`.

- **Choice per campaign.** The email composer's Content area now picks **Block composer** (the
  existing blocks, unchanged) or **Visual builder**. `marketing_campaign.editor`
  (`blocks | visual`, default `blocks`) says which is sent; `marketing_campaign.design` (jsonb:
  GrapesJS project, MJML, compiled HTML) holds the design. Both are kept when switching.
- **Builder** (`apps/admin/src/components/growth/campaigns/visual-builder/`): full-screen
  GrapesJS 0.23.6 with grapesjs-mjml 1.0.8, loaded with `next/dynamic` (`ssr: false`) only when
  opened. Blocks: 1/2/3 columns, text, image (custom asset manager → `MediaPickDialog`, upload
  included), button, divider, spacer, and store blocks (logo, product card, product grid,
  discount code, social links, footer with `{unsubscribe_url}`) drawn with the live theme's logo,
  first colour scheme and social links (`marketing.emailBrand`). Product and discount blocks open
  a picker on drop and are replaced with the real MJML. Text toolbar has an **Insert merge tag**
  select. Starts from a brand starter design.
- **Merge tags** reuse the sender's `{tag}` syntax (`MERGE_TAGS`) plus `unsubscribe_url`
  (`DESIGN_MERGE_TAGS`).
- **Compile + send.** The API recompiles the MJML on every create/update/testSend with `mjml`
  5.4.1 (`@commerce/core/email-design-compile`, server only, includes off, output sanitised); the
  client's HTML is never trusted. `renderDesignedEmail` (pure, `email-design.ts`) fills merge tags
  (escaped in text, raw in links), click-tracks every http(s) link except unsubscribe, adds preview
  text, the standard unsubscribe footer when the design has no `{unsubscribe_url}`, and the open
  pixel; `htmlToPlainText` makes the text part. `sendMarketingEmail` and `testSendCampaignEmail`
  take `designHtml`; the worker needs no MJML.
- **Templates**: `marketing_email_template` (store-scoped, RLS) and
  `marketing.emailTemplates.{list,get,create,delete}` (max 100 per store); the builder's
  **Templates** dialog saves, loads (replaces the canvas) and deletes.
- Copy: `data/email-builder.ts` + Hindi overlay. Merchant guide: Growth → Campaigns. Tests:
  `email-design.test.ts` (pure, includes MJML compile) and two DB cases in `campaigns.test.ts`.
- Not done: the GrapesJS panel UI itself (style manager, layer names) stays in English;
  automations still use the block composer only.
