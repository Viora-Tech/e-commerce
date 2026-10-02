# Open-source radar

Strategy (decided 2026-09-23): before building a feature from scratch, look for a mature
open-source project that already solves it. Take its architecture and, where the licence allows,
its code, and ship it as a plugin under `/apps/<id>` (see `docs/plugins.md`). Credit every
adaptation per `THIRD_PARTY_NOTICES.md`.

Licences below were read from each repository's LICENSE file on 2026-09-23. Re-check before
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
| Analytics | [Umami](https://github.com/umami-software/umami) | MIT | Sessions, referrers, visitor map | Live view globe and analytics |
| Analytics | [PostHog](https://github.com/PostHog/posthog) | MIT outside `ee/` | Funnels, feature flags, session replay design | Ideas, selective code |
| Analytics | [Plausible](https://github.com/plausible/analytics) | AGPL-3.0 | | Ideas only |
| Experiments | [GrowthBook](https://github.com/growthbook/growthbook) | MIT outside its enterprise folders | A/B tests on sections and prices | Experiments plugin |
| Flags | [Unleash](https://github.com/Unleash/unleash) | AGPL-3.0 | | Ideas only |
| Support | [Chatwoot](https://github.com/chatwoot/chatwoot) | MIT outside `enterprise/` | Shared inbox: WhatsApp, email, website chat | Support inbox plugin |
| Search | [Meilisearch](https://github.com/meilisearch/meilisearch) | MIT and BUSL-1.1 (EE parts) | Typo-tolerant storefront search | Search plugin (separate server) |
| Search | [Typesense](https://github.com/typesense/typesense) | GPL-3.0 | | Separate server only |
| Surveys | [Formbricks](https://github.com/formbricks/formbricks) | AGPL-3.0 (core) | | Ideas only |
| Booking | [Cal.com](https://github.com/calcom/cal.com) | MIT | Scheduling, for service-selling stores | Later |
| Ops | [SigNoz](https://github.com/SigNoz/signoz) | MIT outside `ee/` | Logs, traces, metrics | Self-hosted observability |
| Ops | [GlitchTip](https://gitlab.com/glitchtip/glitchtip) | MIT | Sentry-protocol-compatible error tracking server | Done: run it as a separate service, point the official Sentry SDKs at its DSN |
| Invoices | [invoicely](https://github.com/legions-developer/invoicely) | MIT, author's permission | PDF templates | Done: GST invoices app |
| Catalog | [Shopify Product Taxonomy](https://github.com/Shopify/product-taxonomy) | MIT | Standard product category tree | Done: product category picker (trimmed data, `scripts/trim-product-taxonomy.ts`) |
| Admin i18n | [next-intl](https://github.com/amannn/next-intl) (MIT), [typesafe-i18n](https://github.com/ivanhofer/typesafe-i18n) (MIT) | MIT | Nothing copied: both want messages as ICU/format strings, and our copy is TS objects with functions in them (`(n) => ...`), so adopting either meant rewriting every `data/*.ts` | Done in-house (checked 2026-09-27): ~150-line typed overlay, `apps/admin/src/lib/i18n.ts`, Hindi in `data/hi/`. Revisit if we add many languages or need ICU plurals |
| Privacy | [CookieConsent (orestbida)](https://github.com/orestbida/cookieconsent), [Klaro](https://github.com/klaro-org/klaro-js) | MIT, BSD-3-Clause (read from LICENSE 2026-09-27) | Category model (necessary / analytics / marketing), scripts held until their category is allowed, re-asking when the banner changes (revision) | Ideas only, no code copied: both ship their own CSS and DOM, while ours must be Tailwind tokens on the theme's classes and gate our own beacon and `next/script` tags. Built in `apps/storefront/src/components/privacy/` (Settings → Customer privacy, 2026-09-27) |
| Payments | [Razorpay Affordability Widget](https://razorpay.com/docs/payments/payment-gateway/affordability/widget/native-web/) | Not open source: Razorpay's hosted script, for Razorpay merchants under their terms | Product-page EMI, pay later and offers | Done: EMI & pay later app loads it from Razorpay's CDN with the store's public key id; never copied. No open-source EMI widget was worth adopting (checked 2026-09-27); the simple line is `@commerce/core/emi` |
| AI | [Vercel AI SDK](https://github.com/vercel/ai) 7.0 (`ai`, `@ai-sdk/gateway`, `@ai-sdk/provider`), [OpenRouter AI SDK provider](https://github.com/OpenRouterTeam/ai-sdk-provider) 3.1 | Apache-2.0, Apache-2.0 (npm metadata, 2026-10-02) | Structured output with zod, streamed answers, tool calling with approvals, mock models for tests, one interface over Vercel AI Gateway and OpenRouter | Done (AI engine, 2026-10-02): libraries behind our own `packages/ai` interface, no code copied. Alternatives looked at: LangChain.js (MIT, far larger surface than we need), calling each provider's SDK directly (no shared tool/stream layer, no gateway swap). AI v2 assistant (2026-10-02) stays on the same SDK, no new dependency: looked at assistant-ui (MIT) and CopilotKit (MIT) for the chat panel and approval cards; not adopted, because both bring their own runtime and message model while ours needs RLS-scoped tools, a server-side approval log (`ai_action`) and the admin's shadcn/Base UI look |
| Shopper auth | [Better Auth](https://github.com/better-auth/better-auth) 1.7.6 (social providers, one-tap, magic-link, passkey plugins), [SimpleWebAuthn](https://github.com/MasterKale/SimpleWebAuthn) 13 | MIT, MIT (package.json licence fields, 2026-09-28) | Google/Apple/Facebook OAuth with PKCE and ID token checks, One Tap verification, WebAuthn ceremonies | Done (shopper login options, 2026-09-28): provider modules and SimpleWebAuthn used as libraries; the plugins store Better Auth users, so their magic-link and passkey flows are rebuilt on our per-store tables. Truecaller has no open-source SDK: its official web flow is used as documented |

## Order of adoption

1. React Email for campaign and transactional emails.
2. Payload's model (with Instatic's table UX) for the metaobjects to CMS upgrade.
3. Umami's ideas for the Live view globe and India map.
4. Activepieces as the blueprint for automations v2 (Shopify Flow equivalent).
5. Chatwoot as the first plugin that wraps a separate service.
