# AI agents: knowledge base, store agent endpoint, Test a query

Owner asked 17 Nov 2026 to build the three "AI agents" items today (after Shopify's Agentic and Knowledge base pages).

## Knowledge base (Sales channels → Agentic sales → Knowledge base)
- Facts agents may tell shoppers, in four groups: About (description, audience, year founded, location), Brands and products (brands, categories, values, style), Shopping (shipping, payments, returns, support), and FAQ.
- "Scan my store" (AI, product writer allowance) drafts them from public content only: store description, About page, published policies, brands, product types, collections, product titles. Drafts start **Unpublished**.
- Each fact can be edited, published or unpublished; "Publish all" per group. A rescan only rewrites unpublished AI drafts, never what the merchant published or wrote.
- Stored on `store.preferences.agentKnowledge` (no migration). Model: `packages/core/src/sales-channels/knowledge.ts`; DB: `knowledge-service.ts`; AI: `packages/ai/src/store-knowledge.ts`; API: `salesChannels.knowledge`, `knowledgeScan`, `knowledgeSave`, `knowledgePublish`.

## Store agent endpoint: `<store domain>/api/mcp`
- Public, read-only MCP server (Streamable HTTP, stateless JSON-RPC), like Shopify's Storefront MCP. Tools: `search_catalog`, `get_product`, `search_policies_and_faqs`, `get_store_info`.
- Shows only what Agentic sales → Controls allows (hidden tags, chosen collections). Off when the store is password-locked or AI crawlers are off (Online store → Preferences). 60 calls a minute per IP.
- Code: `apps/storefront/src/lib/agent-mcp.ts`, `apps/storefront/src/app/api/mcp/route.ts`, `packages/core/src/sales-channels/agent-store.ts`.
- Not a full UCP or ACP implementation: no checkout, no signing keys. Agents send shoppers to the product page to buy.

## llms.txt
- New "About the store" section (published facts) and "For AI agents" section linking `/api/mcp`.

## Agentic sales page
- Get-ready checklist gains "Publish your knowledge base"; Sources shows the knowledge base count and the agent endpoint; new "Search the way an agent does" box (`salesChannels.testQuery`, same code as the endpoint). The live overview gets a "Knowledge base" button.

## Also
- `buildChannelCatalog` takes `handles` to build only some products.
