# Storefront A/B speed checks with strobe (12 Nov 2026)

`scripts/perf/storefront-pages.ts` walks the storefront's main pages (or product pages only with
`PRODUCTS_ONLY=1`) and fails on any non-200 page; `strobe run` times it on two servers in
alternating pairs and reports the difference with a confidence interval. Usage and the first
result (Hono product pages −71% vs Next) are in the script's header. strobe is run with bunx and
is not a dependency (it was 9 days old on 12 Nov).
