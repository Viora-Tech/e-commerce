# Agentic sales: a "get ready" page like Shopify's (2026-10-26)

Until an agent is live (or needs a look), Agentic sales is no longer four zero tiles, an empty box and four Connect cards with a 3-step dialog each. It is Shopify's Agentic page shape (`components/sales-channels/agentic-get-ready.tsx`):

- Left: one headline and a two-step "Get ready" checklist that links to the work — catalog AI-ready score ≥ 80 (Catalog readiness) and products visible to agents (Controls).
- Right (sticky): **Let Koomerce manage for me** — one switch that asks to be listed with every agent (`salesChannels.connect` per agent with catalog/prices/policies/orders) or withdraws the waiting requests (`salesChannels.cancel`); the agents with their status; Sources (catalog products, AI-ready score).

Once an agent is live, the existing overview (stats, agent cards, recent orders) shows as before. Copy: `salesChannelsContent.getReady`.
