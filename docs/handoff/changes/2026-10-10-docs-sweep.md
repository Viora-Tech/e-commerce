# Docs sweep for 2026-10-10 (#324 to #404)

Branch `docs/2026-10-10-sweep`. Docs only, no code or migration.

## Merchant guide
- **New**: Stock section (`stock/` index, Inventory, Transfers; Purchase orders moved here from
  `catalog/`, old URL redirects in `apps/docs/next.config.mjs`), Several warehouses and GST
  (`money/multi-warehouse-gst`), Analytics (`selling/analytics`), Files and storage
  (`selling/files`).
- **Updated**: Online store (block bar, inline editing everywhere, Advanced tab and new section
  settings controls, Audit, Pages/Media/Theme settings panels, zoom, duplicate-first warning),
  Import a Shopify theme (product/collection/page templates, re-import note), Products (Bulk
  edit, Extra fields card), Orders (order page cards, drafts, abandoned checkouts and their detail
  page), Discounts (pause, resume, duplicate), Apps (Recommended strip, RapidShyp and Umami rows),
  Getting started (new Home and sidebar), GST invoices and Locations (links), Glossary (parcel,
  landed cost, weighted average cost, inbound shipment), What's new and Changelog (10 October).
- Stale paths fixed: Products → Inventory/Suppliers/Inbound shipments are now under Stock;
  Online Store → Pages is Content → Pages.

## Developer docs
- Architecture 2.5 (parcels, routing, GST and cost, short links, theme versions, Umami).
- Data model: short links, themes (thumbnail, versions, blog templates), migrations 0094 to 0106.
- Section settings: the three kinds (`section`, `bleed`, `flow`), theme-named backgrounds.
- Request flow: `routeAndReserve` in the reserve step, `/l/<slug>`, `x-theme-version`.
- Builds on CodeBuild: status box (code only, no AWS resources yet), link to
  `deploy/codebuild/README.md`; Deployment points to it.

## Not checked
- No browser or running admin: every UI label comes from `apps/admin/src/data/*` and the handoff
  notes. Screenshots stay placeholders.
- The CodeBuild "code only" status is as of the 2026-10-10 handoff note; update when AWS resources exist.
