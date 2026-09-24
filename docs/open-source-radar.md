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

## Order of adoption

1. React Email for campaign and transactional emails.
2. Payload's model (with Instatic's table UX) for the metaobjects to CMS upgrade.
3. Umami's ideas for the Live view globe and India map.
4. Activepieces as the blueprint for automations v2 (Shopify Flow equivalent).
5. Chatwoot as the first plugin that wraps a separate service.
