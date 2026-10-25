# Docs: merchant guide follows the admin sidebar, developer docs in four groups

- Merchant guide pages moved into folders in the same order as the admin sidebar (Start here,
  Home, Orders, Products, Stock, Customers, Content, Analytics, Growth, Discounts, Online store,
  Apps, Money & GST, Settings, Help). Moves used `git mv`. Pages that covered two menu items were
  split (Drafts, Abandoned checkouts, Couriers, Bulk edit, Extra fields, Suppliers, Inbound
  shipments, Live view, Links, Campaigns, Pages, Preferences, Themes, Home dashboard). A few short
  pointer pages exist where the content lives elsewhere (Automations, Umami, Back in stock, and
  Settings entries for Payments, Returns, Costs for profit, Custom data).
- Developer docs: Getting started, Core concepts, Building, Operations.
- Every moved page has a permanent redirect from its old URL: `apps/docs/redirects.mjs`, used by
  `next.config.mjs`. `scripts/check-redirects.mjs` and `scripts/check-links.mjs` run before the
  docs build (also `bun run check:redirects` / `check:links` in `apps/docs`).
- Links updated in docs content, `data/*.ts`, the admin editor help URL, README, CLAUDE.md and
  `docs/*.md`. Old handoff change notes were left as history.
- Help > Get help reads WhatsApp and email from `siteConfig` (new `@commerce/config` dependency of
  the docs app, `transpilePackages` in `next.config.mjs`). Help > FAQ is generated from the
  guides' own FAQ sections.
- Not written (no content exists yet): Gift cards, Segments, Blog posts guides.

How to test: open http://localhost:3500, check the merchant menu order against the admin sidebar,
open `/merchant-guide/selling/shipments`, `/merchant-guide/stock` and
`/developer-docs/building/architecture` (each should redirect), and open Help > Get help.
