# AI shopping agent readiness: storefront fixes + Store health checks (20 Nov 2026)

Branch `feat/ai-agent-readiness` (from `origin/dev`). Not pushed.

## Scan of www.waimers.in (is-agentic-storefront.com, 20 Nov, live = main)

73/100, grade C. Access 100, Product data 64, Discovery 78, Operability 90, Agentic commerce 14.
ClaudeBot, GPTBot, PerplexityBot and Google-Extended all get 200 (same page as a browser), so
Cloudflare is not blocking AI bots. Failed or partial: product variants in JSON-LD (fail),
Markdown copy (fail), OpenGraph price tags (partial; already fixed on dev in 06136949d), SKU or
GTIN on two of three products (partial, store content), variant selectors are buttons with
aria-pressed (partial, imported theme's Liquid), TTFB 1.9 s from the US and 693 KB home HTML
(partial), UCP profile, OAuth discovery and cart permalinks (fail).

## Change

- Storefront `lib/seo.ts` + `lib/seo-variants.ts`: a product with several variants is a
  `ProductGroup` (`productGroupID`, `variesBy` for size/colour/material/pattern, `hasVariant`
  with each priced variant's sku, gtin, options, image and Offer). One variant stays `Product`.
- Product page metadata: `og:price:*`, `product:availability`, and
  `<link rel="alternate" type="text/markdown" href="/products/<h>.md">`.
- `/products/<handle>.md` (`products/[handle]/product.md/route.ts`, `lib/shopify-json/markdown.ts`):
  the product as Markdown, via the same rewrite, rate limit and cache as `/products/<h>.json`.
  No `Accept: text/markdown` negotiation: Cloudflare caches product HTML and does not vary on
  Accept, so it could serve Markdown to browsers. llms.txt names the `.md` copies.
- `@commerce/core/agent-readiness` (pure, tested): 11 pass/fail checks and a small robots.txt
  matcher. `packages/api` `agent-readiness.service.ts` fetches the store's live primary domain
  (safeFetch, GET plus one MCP `tools/list`, two parallel rounds, 8 s each) and grades it.
  Route `seo.agentReadiness` (SETTINGS_READ). Null without a live domain.
- Admin: Settings → Store health has an "AI shopping agents" card (`agent-readiness-card.tsx`)
  with a Check now button. Each line is Pass or Fix with a plain fix line and an Open link.
  Copy in `data/agent-readiness.ts` + Hindi. It does not change the Home health counts.

## Left undone

- UCP profile (`/.well-known/ucp`): our MCP tools do not take UCP's `meta`/`catalog` inputs or
  return its product shape yet, so publishing a profile now would mislead agents.
- Cart permalinks `/cart/<variant>:<qty>`: return 404 today.
- Native radio inputs for variant options in the imported theme, and TTFB.
