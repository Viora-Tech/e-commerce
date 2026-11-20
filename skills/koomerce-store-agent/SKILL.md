---
name: koomerce-store-agent
description: Work safely in a Koomerce store through its MCP server - read orders, products, stock, sales and abandoned checkouts, and propose or run changes to products, prices, collections, discounts, order notes, shipments and other admin actions. Use when an AI client (Claude, ChatGPT, Cursor, VS Code) is connected to a Koomerce store's MCP endpoint, or when answering shopper questions through a store's public agent endpoint. Always confirm with the merchant before any change.
compatibility: Needs a Koomerce store connected over MCP (Settings, MCP & API) or a store's public /api/mcp endpoint.
metadata:
  author: Viora-Tech
  koomerce-version: "Koomerce platform, November 2026"
  version: "1.0"
---

# Koomerce store agent

Koomerce gives each store two MCP endpoints:

| Endpoint | Who | What |
| --- | --- | --- |
| `https://<admin host>/api/mcp/<store slug>` | A store member, signed in with OAuth or an access token from Settings, MCP & API | Merchant tools: reads, change proposals, and every admin action through search, describe, run |
| `https://<store domain>/api/mcp` | Anyone, no sign-in, read-only | Shopper tools: `search_catalog`, `get_product`, `search_policies_and_faqs`, `get_store_info` |

Only use tools the server lists in `tools/list`. Never guess a tool name or an admin action path;
find paths with `searchActions`. The full tool list is in
[references/tools.md](references/tools.md).

## Safety rules (follow every time)

1. **Read first.** Answer from read tools before suggesting any change. Quote the figures you
   read (order number, price, stock) back to the merchant.
2. **Confirm before every write.** Before calling a change tool (`proposeDiscount`,
   `proposeCollection`, `proposePriceChange`, `proposeProductUpdate`, `proposeOrderNote`) or
   `runAction` on anything that is not a read, tell the merchant exactly what will change (which
   orders or products, old and new values) and wait for a clear yes in the conversation. A yes
   to one change is not a yes to the next.
3. **Describe before run.** Call `describeAction({ path })` before `runAction`. It returns the
   input JSON Schema, the kind (read, write, sensitive) and `needsApproval`
   (`no`, `always`, `blocked`). Build the input from that schema only.
4. **Changes can run at once.** When the store has "Allow AI clients to make changes" on, a write
   runs immediately with the connecting member's role, unless their role ticks "Needs approval"
   for it. Treat every write as live.
5. **Sensitive actions wait for a person.** Refunds, cancellations, deletes and removes, store
   credit, gift card money, payment keys, staff and roles, billing, domains and MCP settings always
   go to Approvals in the admin, even for the owner. Tell the merchant it is waiting and where to
   approve it. Never retry to get around a wait.
6. **Respect refusals.** `FORBIDDEN`, "blocked" or "changes are off" means the role, the
   connection's areas or a store switch does not allow it. Say so; do not look for another path
   to the same change.
7. **Customer data.** `customerDetails` only answers while "Let clients read customer details"
   is on. Use it only for the task at hand; never copy contact details into other tools, files or
   messages.
8. **Never put secrets in tool inputs** (API keys, passwords, tokens) and never ask the merchant
   for them; payment keys are set by a person in the admin.

## Common merchant tasks

**Orders.** "What needs shipping?" → `pendingOrders({ olderThanDays })`. "Show order 1042" →
`orderDetails({ number: 1042 })`. Lost sales → `abandonedCheckouts({ days })`. To add a staff
note, prefer `proposeOrderNote` (never sends anything to the customer). To pack, ship or mark an
order: `searchActions({ query: "fulfil order" })`, then `describeAction`, confirm, `runAction`.
Cancelling or refunding is sensitive: it waits for approval.

**Products and stock.** `findProducts({ search })` gives handles; `productDetails({ product })`
for one; `lowStock` for what is running out; `listCollections` for collections. Changes:
`proposeProductUpdate` (title, description, search text, tags), `proposePriceChange` (percent
change for a set of products, shows every old and new price, can be undone),
`proposeCollection` (manual collections).

**Shipping.** Use `searchActions({ query: "shipment", area: "orders" })` or a query such as
"courier rates" or "try a PIN code" to find the shipping actions the store has, then describe
them. Booking a courier is a write that costs the merchant money: confirm the courier, the
order and the price first.

**Discounts.** `proposeDiscount` drafts a code (percent, amount or free shipping, whole store,
collections or products, optional dates). Confirm the code, value, scope and dates first. To list
or edit existing discounts, find the action with `searchActions({ query: "discount" })`.

**Sales.** `salesSummary` (pick the period the merchant named; "this month" is `this_month`),
`topProducts`, and `analyticsQuery` for anything else.

## Shopper-facing agent (public endpoint)

On `<store domain>/api/mcp` you act for a shopper: search with `search_catalog`, read one product
with `get_product`, answer shipping, returns and payment questions only from
`search_policies_and_faqs` and `get_store_info`. Link the shopper to the product URL to buy;
there is no checkout over MCP. Never promise prices, stock or delivery dates the tools did not
return.

## When something fails

- Input refused: fix it from `describeAction`'s schema; inputs over 32,000 characters are refused.
- Long answers are cut with a note; ask for a narrower read.
- Files (labels, invoices, CSV) come back as a download link valid for 10 minutes.
- Rate limit: 120 calls a minute per connection on the admin endpoint, 60 per IP on the public one.
