# Open-source radar

Strategy (decided 2026-09-23): before building a feature from scratch, look for a mature
open-source project that already solves it. Take its architecture and, where the licence allows,
its code, and ship it as a plugin under `/apps/<id>` (see `docs/plugins.md`). Credit every
adaptation per `THIRD_PARTY_NOTICES.md`.

Licences below were read from each repository's LICENSE file on 2026-09-23; rows added or re-checked on 2026-10-11 say so. Re-check before
copying: projects relicense (Unleash moved to AGPL, Cal.com moved to MIT).

## Licence rules

| Licence | Copy code into the platform | Otherwise |
| --- | --- | --- |
| MIT, BSD, Apache 2.0 | Yes, keeping the notice | |
| "MIT except `ee/`" (open core) | Yes, only outside the enterprise folders | Never copy from `ee/`, `enterprise/`, `.ee.` files |
| GPL, AGPL | No | Learn from the design; or run the unmodified server as a separate service behind a plugin (legal check before selling it) |
| BSL, SSPL, FSL, Sustainable Use (n8n) | No | Ideas only |

## Projects

| Area | Project | Licence (verified) | What to take | How |
| --- | --- | --- | --- | --- |
| Commerce | [Medusa](https://github.com/medusajs/medusa) | MIT except Enterprise Edition files | Module boundaries, workflows, pricing and promotions engine, tax and fulfilment providers | Patterns into core |
| Commerce | [Saleor](https://github.com/saleor/saleor) | BSD-3-Clause | Stock allocation across warehouses, channels, checkout lifecycle, discounts | Patterns into core |
| Commerce | [Vendure](https://github.com/vendure-ecommerce/vendure) | GPL-3.0 or commercial | Plugin system design | Ideas only |
| CMS | [Payload](https://github.com/payloadcms/payload) | MIT | Collections, field types, drafts and versions, access control; Next.js + Drizzle Postgres adapter | Metaobjects to CMS upgrade |
| CMS | [Strapi](https://github.com/strapi/strapi) | MIT outside `ee/` | Content-type builder UX | Admin UX |
| CMS / builder | [Instatic](https://github.com/CoreBunch/Instatic) | MIT | Data workspace (tables and rows), loops, bindings, visual components, static publish with dynamic holes | CMS now; builder later |
| Builder | [Puck](https://github.com/puckeditor/puck) | MIT | Already our editor | |
| Themes | [LiquidJS](https://github.com/harttle/liquidjs) | MIT (npm metadata and GitHub LICENSE, 2026-10-02) | A Liquid engine that renders a merchant's uploaded Shopify theme exactly; we add Shopify's tags, filters and objects on our data | In use: `packages/core/src/theme-import` (Shopify theme import, 2026-10-02). Shopify's own Liquid is Ruby; no JS port of its Shopify-only filters exists, so those are ours |
| Security | [sanitize-html](https://github.com/apostrophecms/sanitize-html) | MIT (verified 2026-09-27) | Allow-list HTML sanitiser, pure JS (no DOM needed on the server) | Custom HTML element (`@commerce/blocks/embed`). DOMPurify (Apache-2.0 or MPL-2.0) was the alternative; it needs jsdom on the server |
| Builder | [GrapesJS](https://github.com/GrapesJS/grapesjs) | BSD-3-Clause | Drag-and-drop email and newsletter builder | Campaign composer |
| Automations | [Activepieces](https://github.com/activepieces/activepieces) | MIT outside `packages/ee` and `app/ee` | Pieces (integrations), triggers and actions, flow builder UI | Automations v2 plugin |
| Automations | [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Apache-2.0 | Durable jobs, retries, schedules | Backend hardening |
| Automations | [Temporal](https://github.com/temporalio/temporal) | MIT | Durable workflow patterns | Backend hardening |
| Automations | [n8n](https://github.com/n8n-io/n8n) | Sustainable Use License | | Ideas only |
| Email | [React Email](https://github.com/resend/react-email) | MIT | Responsive email components | Campaign and transactional emails |
| Messaging | [Novu](https://github.com/novuhq/novu) | MIT outside `enterprise/packages` | Notification workflows, digests, preference centre | Notifications |
| Marketing | [Dittofeed](https://github.com/dittofeed/dittofeed) | MIT | Journeys, segments | Automations |
| Marketing | [listmonk](https://github.com/knadh/listmonk), [Mautic](https://github.com/mautic/mautic) | AGPL-3.0, GPL-3.0 | | Ideas only |
| Analytics | [Umami](https://github.com/umami-software/umami) | MIT | Sessions, referrers, visitor map | Live view globe and analytics; adopted as the Umami app (connection plugin, `packages/plugin-umami`, 2026-10-10) |
| Analytics | [PostHog](https://github.com/PostHog/posthog) | MIT outside `ee/` | Funnels, feature flags, session replay design | Ideas, selective code |
| Analytics | [Plausible](https://github.com/plausible/analytics) | AGPL-3.0 | | Ideas only |
| Experiments | [GrowthBook](https://github.com/growthbook/growthbook) | MIT outside its enterprise folders | A/B tests on sections and prices | Experiments plugin |
| Flags | [Unleash](https://github.com/Unleash/unleash) | AGPL-3.0 | | Ideas only |
| Support | [Chatwoot](https://github.com/chatwoot/chatwoot) | MIT outside `enterprise/` | Shared inbox: WhatsApp, email, website chat | Support inbox plugin |
| Search | [Meilisearch](https://github.com/meilisearch/meilisearch) | MIT, Enterprise Edition parts BUSL-1.1 (LICENSE, 2026-10-11; unchanged) | Typo-tolerant storefront search | Search plugin (separate server) |
| Search | [Typesense](https://github.com/typesense/typesense) | GPL-3.0 | | Separate server only |
| Surveys | [Formbricks](https://github.com/formbricks/formbricks) | AGPL-3.0 core; `packages/js` etc. MIT; `modules/ee` commercial (LICENSE, 2026-10-11) | Survey types, targeting rules | Ideas only (the MIT SDK is useless without their server) |
| Booking | [Cal.diy](https://github.com/calcom/cal.diy) (open edition; calcom/cal.com redirects here) | MIT (LICENSE, 2026-10-11). README: personal, non-production use; Cal.com itself is now commercial | Availability, event types, booking flow, calendar sync design | Ideas and small MIT pieces only; not run as a multi-tenant service. Own bookings plugin later |
| Ops | [SigNoz](https://github.com/SigNoz/signoz) | MIT outside `ee/` | Logs, traces, metrics | Self-hosted observability |
| Ops | [GlitchTip](https://gitlab.com/glitchtip/glitchtip) | MIT | Sentry-protocol-compatible error tracking server | Done: run it as a separate service, point the official Sentry SDKs at its DSN |
| Ops | [evlog](https://github.com/HugoRCD/evlog) | MIT (npm metadata, 2026-10-13) | Wide-event structured logging, Next.js/Hono adapters, OTLP drain | In use: every server log (`docs/ops/logging.md`), as an npm library, no code copied |
| Ops | [OpenObserve](https://github.com/openobserve/openobserve) | AGPL-3.0 | Log search over OTLP | Separate self-hosted service the logs ship to; nothing of it in this repo |
| Ops | [modern-screenshot](https://github.com/qq15725/modern-screenshot) | MIT (npm metadata, 2026-10-05) | DOM to PNG/JPEG in the browser (html-to-image's maintained successor) | In use: the test server's "Report a bug" screenshot (`apps/admin/src/lib/capture-page.ts`). Our own button and GitHub-issue filing instead of Sentry user feedback or a SaaS widget |
| Invoices | [invoicely](https://github.com/legions-developer/invoicely) | MIT, author's permission | PDF templates | Done: GST invoices app |
| Catalog | [Shopify Product Taxonomy](https://github.com/Shopify/product-taxonomy) | MIT | Standard product category tree | Done: product category picker (trimmed data, `scripts/trim-product-taxonomy.ts`) |
| Admin i18n | [next-intl](https://github.com/amannn/next-intl) (MIT), [typesafe-i18n](https://github.com/ivanhofer/typesafe-i18n) (MIT) | MIT | Nothing copied: both want messages as ICU/format strings, and our copy is TS objects with functions in them (`(n) => ...`), so adopting either meant rewriting every `data/*.ts` | Done in-house (checked 2026-09-27): ~150-line typed overlay, `apps/admin/src/lib/i18n.ts`, Hindi in `data/hi/`. Revisit if we add many languages or need ICU plurals |
| Privacy | [CookieConsent (orestbida)](https://github.com/orestbida/cookieconsent), [Klaro](https://github.com/klaro-org/klaro-js) | MIT, BSD-3-Clause (read from LICENSE 2026-09-27) | Category model (necessary / analytics / marketing), scripts held until their category is allowed, re-asking when the banner changes (revision) | Ideas only, no code copied: both ship their own CSS and DOM, while ours must be Tailwind tokens on the theme's classes and gate our own beacon and `next/script` tags. Built in `apps/storefront/src/components/privacy/` (Settings → Customer privacy, 2026-09-27) |
| Payments | [Razorpay Affordability Widget](https://razorpay.com/docs/payments/payment-gateway/affordability/widget/native-web/) | Not open source: Razorpay's hosted script, for Razorpay merchants under their terms | Product-page EMI, pay later and offers | Done: EMI & pay later app loads it from Razorpay's CDN with the store's public key id; never copied. No open-source EMI widget was worth adopting (checked 2026-09-27); the simple line is `@commerce/core/emi` |
| AI | [Vercel AI SDK](https://github.com/vercel/ai) 7.0 (`ai`, `@ai-sdk/gateway`, `@ai-sdk/provider`), [OpenRouter AI SDK provider](https://github.com/OpenRouterTeam/ai-sdk-provider) 3.1 | Apache-2.0, Apache-2.0 (npm metadata, 2026-10-02) | Structured output with zod, streamed answers, tool calling with approvals, mock models for tests, one interface over Vercel AI Gateway and OpenRouter | Done (AI engine, 2026-10-02): libraries behind our own `packages/ai` interface, no code copied. Alternatives looked at: LangChain.js (MIT, far larger surface than we need), calling each provider's SDK directly (no shared tool/stream layer, no gateway swap). AI v2 assistant (2026-10-02) stays on the same SDK, no new dependency: looked at assistant-ui (MIT) and CopilotKit (MIT) for the chat panel and approval cards; not adopted, because both bring their own runtime and message model while ours needs RLS-scoped tools, a server-side approval log (`ai_action`) and the admin's shadcn/Base UI look |
| Shopper auth | [Better Auth](https://github.com/better-auth/better-auth) 1.7.6 (social providers, one-tap, magic-link, passkey plugins), [SimpleWebAuthn](https://github.com/MasterKale/SimpleWebAuthn) 13 | MIT, MIT (package.json licence fields, 2026-09-28) | Google/Apple/Facebook OAuth with PKCE and ID token checks, One Tap verification, WebAuthn ceremonies | Done (shopper login options, 2026-09-28): provider modules and SimpleWebAuthn used as libraries; the plugins store Better Auth users, so their magic-link and passkey flows are rebuilt on our per-store tables. Truecaller has no open-source SDK: its official web flow is used as documented |
| Builder / effects | [Motion](https://github.com/motiondivision/motion) (`motion`) | MIT (GitHub, 2026-10-11) | Springs, layout, scroll and gesture animation; the base of all section effects | In use. Motion+ (paid) has extra components: not needed, read its licence before any copy |
| Builder / effects | [Magic UI](https://github.com/magicuidesign/magicui) free components | MIT (GitHub, 2026-10-11, 22.6k stars, pushed daily) | Marquee, ticker, beams, grids, text effects as shadcn registry items | In use (see `THIRD_PARTY_NOTICES.md`). Best source for new builder effects: MIT lets us ship them to merchants. Pro stays under `docs/licences/magic-ui-pro.md` |
| Builder / effects | [React Bits](https://github.com/DavidHDev/react-bits) | MIT + Commons Clause (LICENSE.md, 2026-10-11) | 100+ animated backgrounds, text and cursor effects | TRAP: Commons Clause bans selling or redistributing "the components themselves". A website builder that hands them to merchants is that. Ideas only, or ask the author in writing |
| Builder / effects | [Animate UI](https://github.com/imskyleen/animate-ui) | MIT + Commons Clause (LICENSE.md, 2026-10-11) | Motion-based shadcn components (primitives, icons) | TRAP, same as React Bits. Ideas only |
| Builder / effects | [motion-primitives](https://github.com/ibelick/motion-primitives) | MIT (LICENCE.md, 2026-10-11, 6.5k stars) | Text effects, morphing dialog, infinite slider, spotlight on Motion | Copy with notice into shared effects. Clean licence, fits Motion |
| Builder / effects | [Aceternity UI](https://ui.aceternity.com) free tier | Own licence; written permission on file (`docs/licences/`) | Hero and background effects | In use; do not extend without re-reading the permission note |
| Builder / blocks | [Tailark blocks](https://github.com/tailark/blocks) (`@tailark-oss`) | MIT (README, 2026-10-11, 2.3k stars) | Marketing sections (hero, pricing, FAQ, footer) as shadcn registry items | Copy with notice as Puck section starters. Tailark Pro is paid and separately licensed: not covered |
| Builder / blocks | [shadcn/ui](https://github.com/shadcn-ui/ui) blocks and registry | MIT (GitHub, 2026-10-11, 125k stars) | The registry format: our sections could be published and installed as registry items | In use. Best template for a future section marketplace |
| Builder / blocks | coss.com/ui (formerly [Origin UI](https://github.com/cosscom/coss)) | AGPL-3.0 now (LICENSE, 2026-10-11); the older Origin UI was MIT | Dense form and table components | TRAP: the maintained repo is AGPL. Copy nothing new; verify the legacy `apps/origin` licence before any use. Prefer shadcn/Base UI |
| Builder / editing | [Tiptap](https://github.com/ueberdosis/tiptap) | MIT core (GitHub, 2026-10-11, 38.7k stars) | Inline rich text in the Puck canvas | **Already in use** through Puck's own `richtext` field (`inlineRichtext`, `@tiptap/extension-image` in `customize-config.tsx`). Extend Puck's Tiptap setup for on-canvas polish; never add a second editor. Avoid Pro extensions (comments, AI, collaboration are paid) |
| Admin editing | [Lexical](https://github.com/facebook/lexical) | MIT (GitHub, 2026-10-11) | Long-form rich text in the admin | **Already in use** (`packages/editor`: product descriptions, pages, blog posts). Keep it; no migration to Tiptap (decided 2026-10-11) |
| Builder / editing | [BlockNote](https://github.com/TypeCellOS/BlockNote) | MPL-2.0 core; `xl-*` packages GPL-3.0 or commercial (LICENSE.txt, 2026-10-11) | Notion-style block editor | Fine for a CMS rich-text field (core only). Never import `@blocknote/xl-*` (AI, multi-column, exporters) |
| Builder / media | [react-easy-crop](https://github.com/ValentinH/react-easy-crop), [Cropper.js](https://github.com/fengyuanchen/cropperjs) | MIT, MIT (GitHub, 2026-10-11) | In-browser crop and zoom for logos and product images | Library, S. react-easy-crop first |
| Builder / media | [Transformers.js](https://github.com/huggingface/transformers.js) with an Apache-licensed segmentation model | Apache-2.0 library (GitHub, 2026-10-11); models vary | On-device background removal: no upload, no per-image cost | Library plus model, M. TRAP: `@imgly/background-removal` is AGPL-3.0, and popular models (RMBG, Bria) are non-commercial. Read the model card licence; U2-Net / MODNet variants are Apache-2.0 |
| Builder / brand | [colorthief](https://github.com/lokesh/color-thief), [node-vibrant](https://github.com/Vibrant-Colors/node-vibrant) | MIT, MIT (GitHub, 2026-10-11; node-vibrant has no SPDX id on GitHub, check its LICENSE file first) | Logo to brand palette: dominant colours, then our token generator makes contrast-safe light and dark | Library, S. Pair with `culori` (MIT, not re-verified) for OKLCH contrast maths |
| Builder / brand | [Fontsource](https://github.com/fontsource/fontsource) | MIT packaging; each font keeps its own OFL or Apache licence (GitHub, 2026-10-11) | Self-hosted Google fonts (no third-party request), font picker | Library, S. Offer only OFL/Apache families |
| Builder / icons | [Lucide](https://github.com/lucide-icons/lucide), [Tabler Icons](https://github.com/tabler/tabler-icons), [Phosphor](https://github.com/phosphor-icons/react), [Iconify](https://github.com/iconify/iconify) | ISC (Lucide; some icons MIT from Feather), MIT, MIT, MIT (GitHub, 2026-10-11) | Icon picker for sections and menus | Libraries. Iconify's data sets each carry their own licence: filter to MIT/ISC/Apache sets, attribute CC BY ones |
| Commerce | [Gorse](https://github.com/gorse-io/gorse) | Apache-2.0 (GitHub, 2026-10-11, 9.9k stars, v0.5.11) | "You may also like", "bought together", personalised feeds from orders and views | Separate service behind a plugin, L. Start with co-purchase SQL on orders; Gorse once a store has traffic |
| Commerce | [Dub](https://github.com/dubinc/dub) | AGPL-3.0; `(ee)` folders (partners, affiliate programs) under a commercial licence (LICENSE.md, 2026-10-11) | Short links, click analytics, affiliate programs | TRAP: affiliates are the `(ee)` part. Ideas only. Short links: [Kutt](https://github.com/thedevs-network/kutt) (MIT, 11k stars) or [Shlink](https://github.com/shlinkio/shlink) (MIT, 5k stars) as a separate service |
| Commerce | [Kill Bill](https://github.com/killbill/killbill), [Lago](https://github.com/getlago/lago) | Apache-2.0, AGPL-3.0 (GitHub, 2026-10-11) | Subscription billing models: plans, usage, invoices, dunning | Kill Bill: ideas (heavy Java service). Lago: ideas only. Our subscriptions are built in-house on the entitlement model |
| Commerce | [Keygen](https://github.com/keygen-sh/keygen-api) | Fair Core License, converts to Apache-2.0 after two years (LICENSE.md, 2026-10-11) | Software licence keys, machine activation, entitlements | Ideas only for now (the FCL forbids competing use). Licence keys for code kits: build the small version ourselves |
| Commerce | [Medusa](https://github.com/medusajs/medusa) (re-checked) | MIT except Enterprise Edition files (LICENSE, 2026-10-11) | Recipes for wishlist, loyalty points, gift cards, bundles, reviews | Patterns only. Reviews, wishlist, loyalty, gift cards, bundles, size charts, back-in-stock and B2B price lists are small enough to build in-house on our plugin API |
| Payments | [Polar](https://github.com/polarsource/polar) (server) and its SDK | Apache-2.0 server (LICENSE, 2026-10-11); `polar-js` and `polar-python` SDK repos are MIT but archived 2026-09-17, SDK now generated in the main repo (`sdk/`) | Merchant of record for digital goods and subscriptions: checkout, benefits (downloads, licence keys), webhooks, customer portal | Connect plugin through the official SDK for the popup-payments phase, S. Do not self-host Polar: we do not want to be the MoR |
| Payments | [Stripe Node](https://github.com/stripe/stripe-node) | MIT (GitHub, 2026-10-10) | Cards and wallets abroad, subscriptions | Library, S |
| Payments | [Razorpay Node](https://github.com/razorpay/razorpay-node), [Cashfree PG Node](https://github.com/cashfree/cashfree-pg-sdk-nodejs) | MIT, Apache-2.0 (GitHub, 2026-10-11) | Official SDKs for the gateways we target | Libraries. Check which API version the OAuth connect flow needs |
| Payments | [Hyperswitch](https://github.com/juspay/hyperswitch) | Apache-2.0 (LICENSE, 2026-10-11, 45k stars, v1.127.0) | Payments orchestrator by Juspay (India): one API over many gateways, smart routing, retries, UPI | Evaluate later as a separate service, L. Not before our own gateway abstraction is stable |
| Payments | [Lemon Squeezy JS](https://github.com/lmsqueezy/lemonsqueezy.js) | MIT SDK, last push 2024-11 (GitHub, 2026-10-11) | Merchant-of-record SDK | Stale, and the service is Stripe-owned: prefer Polar |
| Marketing | [Maily](https://github.com/arikchakma/maily.to) | MIT (license file, 2026-10-11, 4k stars, v6.2.0) | Tiptap-based email editor with React Email output, variables, slash commands | Best fit for the campaign composer: same Tiptap core as the builder. First choice over GrapesJS, S to M |
| Marketing | [EmailBuilder.js](https://github.com/usewaypoint/email-builder-js) | MIT (GitHub, 2026-10-11, 1.8k stars, last push 2026-02) | JSON-document email editor that renders to HTML | Fallback if Maily lacks blocks; slow upstream |
| Marketing | [Plunk](https://github.com/useplunk/plunk), [useSend](https://github.com/usesend/useSend), [listmonk](https://github.com/knadh/listmonk) | AGPL-3.0 each (GitHub/LICENSE, 2026-10-11) | Email over SES, newsletters | Ideas only (see the open-source email product plan); an unmodified separate service is possible after a legal check |
| Marketing | [Dittofeed](https://github.com/dittofeed/dittofeed) (re-checked) | MIT (GitHub, 2026-10-11, 3k stars) | Journeys, segments, abandoned-cart and win-back flows, email/SMS/WhatsApp channels | Strongest candidate for abandoned-cart flows: model plus selective code, M |
| Marketing | [web-push](https://github.com/web-push-libs/web-push) | MPL-2.0 (LICENSE, 2026-10-11) | Web push (VAPID) for back-in-stock and order updates | Library, unmodified (MPL is file-level, fine as an npm dependency), S |
| Forms | [OpnForm](https://github.com/OpnForm/OpnForm), [HeyForm](https://github.com/heyform/heyform) | AGPL-3.0, AGPL-3.0 (README/GitHub, 2026-10-11; OpnForm also offers dual licensing) | Form builders, quizzes | Ideas only. Build quiz and product-finder as a Puck section with answers stored in metaobjects |
| Forms / phone | [react-phone-number-input](https://gitlab.com/catamphetamine/react-phone-number-input), [libphonenumber-js](https://gitlab.com/catamphetamine/libphonenumber-js) | MIT (LICENSE files in the npm packages, 2026-10-11) | International phone field with flag + calling-code picker, E.164 parsing and validation | In use: `PhoneInput` (`packages/ui/src/components/phone-input.tsx`) on every admin and storefront phone field, `normalisePhone`/`isValidPhone` in `packages/core/src/accounts/phone.ts`. Credited in `THIRD_PARTY_NOTICES.md` |
| Ops | [Uptime Kuma](https://github.com/louislam/uptime-kuma) | MIT (GitHub, 2026-10-11, 92k stars, 2.5.6) | Uptime checks, public status page | Separate service on the tools box now; later a status page per store, S |
| Ops | [restic](https://github.com/restic/restic), [pgBackRest](https://github.com/pgbackrest/pgbackrest) | BSD-2-Clause, MIT (LICENSE, 2026-10-11; pgBackRest 2.59.3) | Encrypted file/volume backups to R2/S3; Postgres base backups plus WAL for point-in-time restore | Tools on the server, S to M. pgBackRest for the database, restic for uploads and volumes |
| Ops | [imgproxy](https://github.com/imgproxy/imgproxy) | Apache-2.0 (LICENSE, 2026-10-11, v4.0.17) | On-the-fly resize and format from R2 behind the CDN | Only if the upload-time pipeline stops being enough (it pre-generates sizes with sharp, Apache-2.0) |
| Ops | [Infisical](https://github.com/Infisical/infisical) | MIT Expat except `ee/` (LICENSE, 2026-10-11) | Secrets vault, audit log | Separate service, core only; rotation and parts of SSO/audit are in `ee/`. Compare with Dokploy env plus AWS Secrets Manager before adding a service |
| Ops | [Flagsmith](https://github.com/Flagsmith/flagsmith), [Flipt](https://github.com/flipt-io/flipt), [Unkey](https://github.com/unkeyed/unkey) | BSD-3-Clause; Fair Core License; open core with commercial parts (LICENSE, 2026-10-11) | Feature flags; API-key management | Flagsmith if ever needed. Flipt and Unkey: ideas only. Our own flags table is enough for now |
| Ops | [GrowthBook](https://github.com/growthbook/growthbook) (re-checked) | MIT except the `enterprise` folders in back-end, front-end and shared, under the GrowthBook Enterprise License (LICENSE, 2026-10-11) | A/B tests, feature flags | As before; never copy from the enterprise folders |

## Traps (look open, are not)

- **Commons Clause** (React Bits, Animate UI): MIT text plus a ban on redistributing the components. A builder that ships them to merchants is redistribution.
- **Open core**: Dub (affiliates in `(ee)`), Formbricks, Infisical, Meilisearch, Medusa, GrowthBook, Unkey, Novu, Chatwoot. The repo says "MIT" or "AGPL"; the valuable part sits in `ee/`.
- **Renamed or relicensed**: Origin UI is now coss.com/ui (AGPL); Cal.com's open edition is Cal.diy (MIT but "non-production"); Flipt and Keygen use the Fair Core License.
- **AGPL that looks like an npm package**: `@imgly/background-removal` (the model terms differ again). Running it in the browser still ships AGPL code to users.
- **Model licences**: on-device models are often non-commercial (RMBG, Bria). Check the model card, not the code licence.
- **Split packages**: BlockNote core is MPL-2.0 but `xl-*` is GPL-3.0; Tiptap core is MIT but Pro extensions are paid.

## Order of adoption (next three months, from 2026-10-11)

Pre-launch quick wins (October): make the builder easy and beautiful, and what Waimers needs at launch.

1. **On-canvas editing polish via Puck's existing Tiptap field** (floating toolbar, allowed marks), the "demo.puckeditor.com feel". No new editor: Lexical stays for the admin, Tiptap stays where Puck brings it; Maily later reuses Tiptap.
2. **motion-primitives, Magic UI and Tailark blocks (all MIT)** as the next section and effect starters, copied with notice into shared effects. Skip React Bits and Animate UI.
3. **Logo to brand palette** (colorthief + culori), **Fontsource** font picker, **Lucide/Tabler** icon picker, **react-easy-crop** for logos. All small MIT libraries.
4. **Polar** (official SDK) connect plugin for popup payments, plus the **Razorpay and Cashfree SDKs** for India checkout.
5. **pgBackRest + restic** backups, then **Uptime Kuma** on the tools box (already on the launch plan days).
6. **web-push** for back-in-stock and order notifications, on top of the pre-order and back-in-stock plugin.
7. React Email for transactional emails.

November to December (growth):

8. **Maily** in the campaign composer; **Dittofeed**'s model for abandoned-cart and win-back journeys.
9. Payload's model with Instatic's table UX for the metaobjects to CMS upgrade; Activepieces blueprint for automations v2.
10. Reviews, wishlist, loyalty points, gift cards, bundles, size charts, B2B price lists: in-house on the plugin API, Medusa and Saleor as pattern references.
11. **Transformers.js** background removal with an Apache-2.0 model, after reading the model card.
12. Chatwoot as the first plugin that wraps a separate service.

January and later:

13. Gorse recommendations once a store has traffic (co-purchase SQL before that).
14. Bookings plugin using Cal.diy's design as reference (not run as a service).
15. Hyperswitch evaluation; Infisical or Flagsmith only if Dokploy env plus AWS secrets become painful.
16. Short links via Kutt or Shlink as a separate service; Umami (done) extended with the live view globe.
