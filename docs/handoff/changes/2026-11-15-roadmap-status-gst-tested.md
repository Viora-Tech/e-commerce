# Roadmap status for 15 Nov, GST invoices marked tested

- `docs/roadmap.md`: status table rewritten for 15 Nov (admin design audit, releases #1707–#1721,
  edge cache live, Rust worker parked, apps group 2 audit done, store credit done).
- GST invoices (`packages/plugin-gst-invoices/src/plugin.ts`) now has `tested: true`: the owner
  confirmed it end to end on Waimers (invoices, receipt and refund vouchers, credit notes and
  cancellation through Approvals). Delhivery was already marked tested.
- Edge cache went live on 15 Nov: Cloudflare cache rule "Store pages" on the koomerce.app zone,
  `STOREFRONT_EDGE_TTL=300` on the storefront, and the worker has `CLOUDFLARE_CACHE_PURGE_TOKEN`
  (Zone › Cache Purge) and `CLOUDFLARE_ZONE_ID`; an edit purges the store's hosts in about 5 s
  (log line "edge cache purged").
