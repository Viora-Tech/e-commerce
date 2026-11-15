# Docs coverage audit (15 November 2026)

Owner's ask (15 Nov): the docs should read A to Z, with diagrams in Excalidraw, so the owner, a
new developer or a merchant can learn what each part is, why it is built that way and how it
works. This audit lists every admin page, storefront route, app, worker queue and data area on
`origin/dev` (d1a03289f) and says where the docs cover it and how well. It was the plan for
branch `docs/a-to-z`; the **After** column is what that branch left.

Ratings: **none** (no page says what it is), **thin** (a mention, a pointer or a stub under about
40 lines), **good** (what it is for and how to use it, with the real labels).
Paths: MG = `apps/docs/content/merchant-guide/`, DD = `apps/docs/content/developer-docs/`.

## Summary

| | Items | Before: good / thin / none | After: good / thin / none |
| --- | --- | --- | --- |
| Admin pages (86 sections covering the 188 routes in `apps/admin/src/app`) | 86 | 60 / 17 / 9 | 71 / 15 / 0 |
| Storefront routes and system pages (24 groups) | 24 | 8 / 11 / 5 | 18 / 6 / 0 |
| Apps (`definePlugin` manifests, core included) | 38 | 34 / 2 / 2 | 36 / 2 / 0 |
| Worker queues (`packages/queue/src/index.ts` and core) | 48 | 13 / 0 / 35 | 48 / 0 / 0 |
| Data areas (`packages/db/src/*-schema.ts` and app packages) | 12 | 6 / 4 / 2 | 12 / 0 / 0 |
| Diagrams in Excalidraw | 8 asked | 0 | 8 |

"After" for worker queues and data areas counts the new developer pages
(`DD/how-it-works/worker-and-jobs.mdx`, `DD/how-it-works/data-model.mdx`), which list every one.
Also found: the Automations app's App Store "guide" link pointed at
`/merchant-guide/apps/automations`, which did not exist (404); the page now exists.

## Admin pages

| Section | Admin route(s) | Merchant guide | Developer docs | Before | After |
| --- | --- | --- | --- | --- | --- |
| Sign in, pick a store, accept an invitation | `/login`, `/select-store`, `/accept-invitation/[id]` | MG/start-here/set-up-your-store, MG/settings/staff | DD/getting-started/running-locally | good | good |
| Onboarding | `/onboarding` | MG/start-here/set-up-your-store | DD/getting-started/running-locally | good | good |
| Home | `/` | MG/home/home-dashboard | — | thin | thin |
| Ask AI | (side panel) | MG/home/ask-ai | DD/building/ai-assistant, DD/how-it-works/ai-and-mcp | good | good |
| Orders list and order page | `/orders`, `/orders/[id]` | MG/orders/orders | DD/core-concepts/request-flow, DD/how-it-works/orders | good | good (+ diagram) |
| Edit an order | `/orders/[id]/edit` | — | — | none | good: MG/orders/edit-an-order |
| Ship an order | `/orders/[id]/ship` | MG/orders/shipments | DD/how-it-works/shipping | good | good |
| Bulk edit orders | `/orders/bulk-edit` | MG/orders/orders ("Doing many at once") | — | thin | thin |
| Drafts | `/orders/drafts/*` | MG/orders/drafts | — | good | good |
| Abandoned checkouts | `/orders/abandoned-checkouts/*` | MG/orders/abandoned-checkouts | — | thin | thin |
| Shipments, Needs attention, Pickups | `/orders/shipments/*` | MG/orders/shipments, MG/apps/couriers | DD/building/delivery-options, DD/how-it-works/shipping | good | good |
| Returns | `/orders/returns/*` | MG/orders/returns-and-rto | DD/core-concepts/data-model | good | good |
| Packing slips | `/orders/packing-slips` | MG/settings/printed-documents | — | thin | thin |
| Products and variants | `/products`, `/products/[id]`, `.../variants/[variantId]` | MG/products/products-collections | DD/core-concepts/data-model | good | good |
| Collections | `/products/collections/*` | MG/products/products-collections | — | good | good |
| Gift cards | `/products/gift-cards/*` | mentioned in 12 pages, no page | — | none | good: MG/products/gift-cards |
| Pre-orders | `/products/preorders/*` | MG/products/pre-orders | DD/core-concepts/data-model | good | good |
| Bulk edit products | `/products/bulk-edit` | MG/products/bulk-edit | — | thin | thin |
| Write with AI (bulk) | `/products/bulk-write` | MG/settings/ai, MG/home/ask-ai | DD/building/ai-assistant | thin | thin |
| Stock overview | `/stock` | MG/stock/overview | DD/getting-started/architecture §2.5 | good | good |
| Inventory | `/stock/inventory` | MG/stock/inventory | — | good | good |
| Purchase orders | `/stock/purchase-orders/*` | MG/stock/purchase-orders | DD/building/ai-engine | good | good |
| Inbound shipments | `/stock/inbound-shipments/*` | MG/stock/inbound-shipments | — | thin | thin |
| Suppliers | `/stock/suppliers/*` | MG/stock/suppliers | — | thin | thin |
| Transfers | `/stock/transfers/*` | MG/stock/transfers | — | good | good |
| Customers list and customer page | `/customers`, `/customers/[id]` | MG/customers/customers | DD/building/customer-privacy | good | good |
| Customer segments | `/customers/segments/*` | mentioned in Discounts, Campaigns | — | none | good: MG/customers/segments |
| Bulk edit customers | `/customers/bulk-edit` | — | — | none | good: MG/customers/segments ("Edit many customers") |
| Blog posts | `/content/blog-posts/*` | mentioned in 10 pages, no page | — | none | good: MG/content/blog-posts |
| Files | `/content/files/*` | MG/content/files-and-storage | DD/building/media-pipeline | good | good |
| Menus and redirects | `/content/menus/*` | MG/content/menus-and-redirects | DD/building/menus-redirects | good | good |
| Content types | `/content/metaobjects/*` | MG/content/content-types | DD/building/content-types | good | good |
| Analytics overview | `/analytics` | MG/analytics/overview | — | good | good |
| Reports, Ask a question, Custom query | `/analytics/reports/*` | MG/analytics/reports | DD/building/ai-assistant (`analyticsQuery`) | good | good |
| Live view | `/analytics/live` | MG/analytics/live-view | DD/building/live-globe | thin | thin |
| Profit | (Analytics) | MG/analytics/profit | DD/getting-started/architecture §2.5 | good | good |
| Growth overview | `/growth` | MG/growth/overview | — | good | good |
| Attribution | `/growth/attribution` | MG/growth/attribution | — | good | good |
| Autopilot | `/growth/autopilot` | MG/growth/autopilot | — | good | good |
| Campaigns | `/growth/campaigns/*` | MG/growth/campaigns | — | good | good |
| Marketing automations | `/growth/automations/*` | MG/growth/automations (8-line pointer) | — | thin | good: points to MG/apps/automations |
| Tracking links | `/growth/links` | MG/growth/links | DD/getting-started/architecture §2.5 | good | good |
| Discounts | `/discounts/*` | MG/discounts | — | good | good |
| Markets | `/markets/*` | MG/markets | — | good | good |
| Catalogs | `/markets/catalogs/*` | — | — | none | good: MG/markets ("Catalogs") |
| Rollouts | `/markets/rollouts/*` | MG/rollouts | DD/building/experiments | good | good |
| Themes | `/online-store/themes` | MG/online-store/themes | DD/building/theme-editor | good | good (+ diagram) |
| Customize (theme editor) | `/online-store/themes/[id]/editor` | MG/online-store/website-builder | DD/building/theme-editor | good | good |
| Edit code | `/online-store/themes/[id]/code` | MG/online-store/import-a-shopify-theme | DD/building/shopify-theme-import | good | good |
| Import a theme | `/online-store/themes/import`, `.../[id]/import` | MG/online-store/import-a-shopify-theme | DD/building/shopify-theme-import | good | good |
| Pages | `/online-store/pages/*` | MG/content/pages (14 lines) | — | thin | thin |
| Blog (settings) | `/online-store/blog` | — | — | none | good: MG/content/blog-posts |
| Preferences | `/online-store/preferences` | MG/online-store/preferences | — | thin | thin |
| SEO | `/online-store/seo` | MG/products/search-keywords (part) | — | none | good: MG/online-store/seo |
| Agentic sales | `/sales-channels/agentic/*` | MG/sales-channels/agentic-sales | DD/building/sales-channels | good | good |
| Social media (Meta, Google) | `/sales-channels/social/*` | MG/sales-channels/social-media | DD/building/sales-channels, DD/building/platform-apps | good | good |
| Inbox | `/sales-channels/inbox/*` | MG/apps/inbox | — | good | good |
| Apps, App Store, install | `/apps`, `/apps/store`, `/apps/install` | MG/apps/app-store | DD/building/plugins, DD/building/first-app | good | good (+ diagram) |
| An app's own pages | `/apps/[pluginId]/[[...path]]` | one page per app (below) | DD/building/plugins §6 | good | good |
| Settings home and Store details | `/settings`, `/settings/store` | MG/settings/index | — | good | good |
| Activity log | `/settings/activity` | MG/settings/activity-log | DD/building/activity-log | good | good |
| AI | `/settings/ai` | MG/settings/ai | DD/building/ai-engine | good | good |
| Appearance | `/settings/appearance` | MG/settings/your-account (part) | — | thin | thin |
| Approvals | `/settings/approvals` | MG/settings/mcp-and-api, MG/settings/staff (parts) | DD/building/mcp-and-api | thin | good: MG/settings/approvals |
| Plan and billing | `/settings/billing/*` | MG/settings/plan-and-billing | DD/building/billing | good | good |
| Checkout | `/settings/checkout` | MG/settings/checkout | — | good | good |
| Costs, Monthly expenses | `/settings/costs`, `/settings/expenses` | MG/settings/costs, MG/settings/monthly-expenses | — | good | good |
| Custom data | `/settings/custom-data/*` | MG/settings/custom-data (8-line pointer), MG/products/extra-fields | DD/building/content-types | thin | thin |
| Customer accounts | `/settings/customer-accounts` | MG/settings/customer-accounts | DD/building/shopper-login | good | good |
| Domains | `/settings/domains/*` | MG/settings/domains | DD/building/custom-domains | good | good |
| Locations | `/settings/locations/*` | MG/settings/locations | — | good | good |
| MCP and API | `/settings/mcp/*` | MG/settings/mcp-and-api | DD/building/mcp-and-api | good | good |
| Notifications | `/settings/notifications` | MG/settings/notifications | DD/operations/email-sending | good | good |
| Payments | `/settings/payments/*` | MG/settings/payments, MG/money-and-gst/payments | DD/how-it-works/payments | good | good |
| Policies | `/settings/policies/*` | MG/settings/policies | — | good | good |
| Customer privacy | `/settings/privacy/*` | MG/settings/customer-privacy | DD/building/customer-privacy | good | good |
| Returns | `/settings/returns` | MG/settings/returns (pointer to Returns & RTO) | — | good | good |
| Shipping | `/settings/shipping/*` | MG/settings/shipping | DD/building/delivery-options | good | good |
| Staff and roles | `/settings/staff/*` | MG/settings/staff | DD/core-concepts/security | good | good |
| Store health | `/settings/store-health` | one mention in Products | — | none | good: MG/settings/store-health |
| Taxes | `/settings/taxes` | MG/settings/taxes | DD/building/gst-returns | good | good |
| Printed documents | `/settings/templates/*` | MG/settings/printed-documents | — | thin | thin |
| Your account (profile, security, sessions, language, notifications, bug reports) | `/account/*` | MG/settings/your-account, MG/settings/language | DD/operations/bug-reports | good | good |
| Platform console | `/platform/*` | — (staff only) | DD/operations/platform-console | good | good |
| Dev tools | `/dev/editor`, `/dev/emails/*` | — (development only) | DD/getting-started/running-locally | thin | thin |
| MCP consent | `/oauth/authorize` | MG/settings/mcp-and-api | DD/building/mcp-and-api | good | good |

Thin pages left as they are (not daily, or the pointer is the right answer): Home, bulk edits,
Abandoned checkouts, Packing slips, Inbound shipments, Suppliers, Live view, Pages, Preferences,
Appearance, Custom data, Printed documents, dev tools. Next pass, in that order.

## Storefront routes and system pages

All under `apps/storefront/src/app/-s/[storeId]/` unless noted; the proxy rewrites the public
path (`lib/routing.ts`). Developer docs for all of them: DD/core-concepts/request-flow,
DD/how-it-works/themes-and-storefront, DD/building/performance.

| Route | What | Docs | Before | After |
| --- | --- | --- | --- | --- |
| `/`, `/products/[handle]`, `/collections/*`, `/pages/[handle]`, `/blogs/*`, `/policies/[type]`, `/search` | Theme pages, shared at the edge | MG/online-store/*, DD/building/performance "Caching" | good | good |
| `/cart`, `/checkout`, `/checkout/pay/[number]`, `/checkout/thank-you/[number]` | Cart and checkout | MG/settings/checkout, DD/core-concepts/request-flow §3 | good | good |
| `/checkout/balance/[token]`, `/checkout/invoice/[token]`, `/checkout/recover/[token]`, `/checkout/start`, `/c/[token]` | Pre-order balance, draft invoice, recovery links | MG/products/pre-orders, MG/orders/drafts, MG/orders/abandoned-checkouts | thin | good: DD/how-it-works/orders |
| `/cod/[token]` | COD confirmation (COD & RTO app) | MG/apps/cod-rto | good | good |
| `/account/*` (login, register, orders, return, addresses, store credit, privacy, profile) | Shopper accounts | MG/settings/customer-accounts, DD/building/shopper-login | good | good |
| `/-a/*` (OAuth, Truecaller) | Platform login domain | DD/building/shopper-login | good | good |
| `/track-order` | Order tracking | MG/orders/shipments (part) | thin | good: DD/how-it-works/shipping |
| `/wishlist`, `/pages/wishlist` | Wishlist | — | none | thin: DD/how-it-works/themes-and-storefront (listed) |
| `/affiliate`, `/affiliate/join` | Affiliate portal | MG/apps/affiliates | good | good |
| `/reviews/*`, `/inbox/*`, `/theme-actions/[action]` | App and theme form posts | MG/apps/reviews, MG/apps/inbox, DD/building/shopify-theme-import | thin | good: DD/how-it-works/themes-and-storefront |
| `/documents/[id]` | Invoice download (signed) | MG/money-and-gst/gst-invoices | thin | good: DD/how-it-works/gst-and-invoices |
| `/l/[slug]` | Short link | MG/growth/links, DD/getting-started/architecture | good | good |
| `/llms.txt`, `/robots.txt`, `/sitemap.xml` | Search and AI crawlers | MG/sales-channels/agentic-sales (part) | thin | good: MG/online-store/seo |
| `/newsletter/confirm/[token]`, `/unsubscribe/[token]`, `/api/m/*` | Email opt-in, unsubscribe, opens and clicks | MG/growth/campaigns (part) | thin | thin |
| `/recommendations/*`, `/search/suggest*` | Theme JSON endpoints | MG/apps/search-and-discovery | thin | thin |
| `/theme-assets/[themeId]/[file]` | Imported theme files | DD/building/shopify-theme-import | good | good |
| `/-p/*` | Password page while the store is locked | MG/start-here/going-live | thin | good: DD/how-it-works/themes-and-storefront |
| `/-h/*` | Plain HTML pages (no React) | DD/building/performance | thin | good: DD/how-it-works/performance-and-caching |
| `/-x/*`, `apps/storefront-hono` | Hono product page pilot | `docs/research/2026-11-storefront-hono-pilot.md` only | none | good: DD/how-it-works/performance-and-caching |
| `/-c/[storeId]` | Inbox chat frame | — | none | thin: DD/how-it-works/themes-and-storefront (listed) |
| `[...missing]`, `not-found`, `error` | 404 and errors inside the theme | — | none | good: DD/how-it-works/themes-and-storefront |
| `/api/beacon`, `/api/px`, `/api/vitals`, `/api/consent-shown`, `/api/experiments`, `/api/referral` | Analytics, pixels, Web Vitals, consent, A/B, referrals | MG/analytics/*, DD/building/experiments | thin | thin |
| `/api/back-in-stock/*` | Back-in-stock opt-in links | MG/apps/back-in-stock (10 lines) | thin | thin |
| `/api/health`, `/api/islands/*`, `/api/hono-island/*` | Health check, plain HTML islands | — | none | good: DD/how-it-works/deploy-and-operations, performance-and-caching |

## Apps

From every `definePlugin` in `packages/*/src/plugin.ts` and `packages/core/src/**/app.ts`
(`tested: true` shows no "Untested" badge in the App Store).

| id | Name | Kind | Category | Tested | Merchant guide | Before | After |
| --- | --- | --- | --- | --- | --- | --- | --- |
| core | Built-in (COD, manual UPI, demo courier) | builtin | — | — | MG/money-and-gst/payments | good | good |
| automations | Automations | builtin | operations | — | listing pointed at a missing page | none | good: MG/apps/automations |
| cod-rto | COD & RTO | builtin | operations | — | MG/apps/cod-rto | good | good |
| inbox | Inbox | builtin | messages | — | MG/apps/inbox | good | good |
| pixels | Pixels (unlisted) | builtin | marketing | — | MG/apps/pixels | good | good |
| delivery-options | Delivery options | builtin | shipping | — | MG/apps/delivery-options | good | good |
| gst-invoices | GST invoices | builtin | invoicing | — | MG/money-and-gst/gst-invoices | good | good (+ DD/how-it-works/gst-and-invoices) |
| affiliates | Affiliates | builtin | marketing | — | MG/apps/affiliates | good | good |
| back-in-stock | Back in stock | builtin | marketing | — | MG/apps/back-in-stock (10 lines) | thin | thin |
| emi-pay-later | EMI & pay later | builtin | marketing | — | MG/apps/emi-and-pay-later | good | good |
| forms | Forms | builtin | marketing | — | no listing guide, no page | none | good: MG/apps/forms |
| reviews | Reviews | builtin | marketing | — | MG/apps/reviews | good | good |
| search | Search & discovery | builtin | search | — | MG/apps/search-and-discovery | good | good |
| shopify-import | Shopify importer | builtin | migration | yes | MG/start-here/move-from-shopify | good | good |
| chatwoot | Chatwoot | connection | messages | — | MG/apps/chatwoot | good | good |
| growthbook | GrowthBook | connection | marketing | — | MG/apps/growthbook | good | good |
| meilisearch | Meilisearch | connection | search | — | MG/apps/meilisearch | good | good |
| google-search-console | Google Search Console | connection | analytics | — | MG/apps/google-search-console | good | good |
| umami | Umami | connection | analytics | — | MG/analytics/visitor-analytics | good | good |
| ses | Amazon SES email | connection | messages | — | MG/settings/sender-email | good | good |
| whatsapp | WhatsApp | connection | messages | — | MG/settings/notifications | good | good |
| razorpay | Razorpay | connection | payments | yes | MG/money-and-gst/payments | good | good |
| cashfree | Cashfree | connection | payments | — | MG/money-and-gst/cashfree | good | good |
| decentro | Decentro | connection | payments | — | no listing guide; parts of MG/money-and-gst/payments | thin | thin |
| delhivery | Delhivery | connection | shipping | yes | MG/orders/shipments, MG/apps/couriers | good | good (+ diagram) |
| bluedart, dtdc, ekart, shadowfax, xpressbees | Couriers | connection | shipping | — | MG/apps/couriers | good | good |
| shiprocket, rapidshyp | Aggregators | connection | shipping | — | MG/orders/shipments, MG/apps/couriers | good | good |
| india-post | India Post | connection | shipping | — | MG/apps/india-post | good | good |
| dhl-express, fedex, shipglobal | International | connection | shipping | — | MG/apps/international-couriers | good | good |
| r2 | Cloudflare R2 | connection | storage | yes | MG/content/files-and-storage | good | good |
| s3 | Amazon S3 | connection | storage | — | MG/content/files-and-storage | good | good |

(The rows for five couriers, two aggregators and three international couriers count as 10 apps
in the summary.) How an app installs and runs is now one page with a diagram:
DD/how-it-works/apps; the SDK stays in DD/building/plugins and DD/building/first-app.

## Worker queues

48 queue names on `origin/dev` (`packages/queue/src/index.ts`, `packages/core/src/**`). Before:
DD/core-concepts/request-flow §4 named 13 of them (7 repeat, 6 on demand) and
DD/getting-started/architecture §3 gave 7 per-store caps; 35 were in no doc. After:
DD/how-it-works/worker-and-jobs lists all of them with what one job is, the per-store cap and the
interval.

- Scheduled (most now run as named jobs on `{system}-sweeps`, `apps/worker/src/sweeps.ts`):
  `{outbox}-relay` 5 s, `{system}-heartbeat` 1 min, unpaid-order-expiry 1 min, preorder-balance
  1 min, domain-certificate 1 min, rollouts-tick 1 min, domain-verify 2 min, marketing-tick and
  automations-tick 30 s, order-push 5 min, sender-email-verify 5 min, review-requests 10 min,
  member-daily-summary 10 min, bug-report-sync 15 min, review-summaries 15 min, shipping-tracker
  30 min, payment-fees 30 min, store-credit-expiry / import-snapshot-cleanup /
  affiliate-commissions / home-cards / search-console-sweep / billing-sweep 1 h,
  `{channels}-sync` 6 h, refund-sync / api-activity-prune / store-activity-prune /
  automations-prune / pixels-prune / shopify-token-sweep 1 day, retention-prune, fx-rates
  21:30 IST.
- On demand: `{notifications}-send`, `{apps}-events`, `{apps}-jobs`, `{marketing}-send`,
  `{media}-process`, `{back-in-stock}-restock`, `{store}-export`, `{domains}-route`,
  `{reviews}-summaries`, `{ai}-bulk-write`, `{ai}-purchase-documents`, `{themes}-screenshot`,
  `{automations}-trigger`, `{automations}-step`, `{pixels}-order`, `{pixels}-send`,
  `{inbox}-ai-reply`.
- Retired: `{abandoned}-sweep` (replaced by the abandoned-checkout automation; its schedule is
  removed on boot).

## Data areas

| Area | Tables (examples) | Before | After |
| --- | --- | --- | --- |
| Platform (no `store_id`) | user, session, organization, member, store | good: DD/core-concepts/data-model | good |
| Store setup | store_domain, store_member, role, role_approval, business, gst_registration, location | good | good |
| Catalog | product, variant, collection, media, metafield, metaobject, gift_card, discount | good | good |
| Stock and buying | inventory_level, transfer, purchase_order, inbound_shipment | good | good |
| Customers and carts | customer, address, customer_segment, cart, store_credit_account | thin | good |
| Orders and money | order, fulfillment_order, payment, refund, return_request | good | good |
| Shipping | shipment, shipment_shared_order, shipment_pickup, shipping_zone | thin | good |
| Online store | theme, theme_template, theme_version, theme_file, page, market, translation | good | good |
| Growth and messages | marketing_*, automation_*, notification, inbox_*, pixel_*, rollout | thin | good |
| Platform plumbing | outbox_event, store_activity, ai_action, api_grant, platform_audit_event | thin | good |
| Billing | store_plan, usage_bill, plan_payment, app_purchase | none (DD/building/billing has states, no table map) | good |
| Apps' own tables | invoice*, review*, affiliate*, back_in_stock_*, shopify_import_*, contact_message, experiment_event | none | good |

After: DD/how-it-works/data-model, with the `data-model` diagram.
