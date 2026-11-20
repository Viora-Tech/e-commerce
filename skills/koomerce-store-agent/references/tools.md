# Koomerce MCP tools

What a Koomerce store's MCP servers list, as of November 2026. The server's own `tools/list` is
always the truth: a tool you are not allowed to use is not listed, and names here may change.

## Admin endpoint: `POST https://<admin host>/api/mcp/<store slug>`

Streamable HTTP, stateless JSON-RPC. Sign-in is OAuth 2.1 with PKCE (a `401` carries
`WWW-Authenticate: Bearer resource_metadata=...` so clients find it), or a store access token.
Every call acts as one store member, capped by their role and by the connection's areas
(`products`, `orders`, `customers`, `inventory`, `discounts`, `content`, `analytics`,
`marketing`, `online_store`, `settings`, each read or write). Every call is logged in
Settings, MCP & API, Activity.

### Read tools (run at once)

| Tool | Input | Returns |
| --- | --- | --- |
| `salesSummary` | `period` (`days`, `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `this_year`, `custom`), `days`, `from`, `to` | Net and gross sales, orders, average order, cancellations, refunds, discounts, visits, conversion, against the period before |
| `topProducts` | period fields, `limit` (1 to 10) | Best sellers by units, with revenue |
| `analyticsQuery` | `query` (one query, one clause per line) | Any other report |
| `pendingOrders` | `olderThanDays` (0 to 30, default 2) | Open orders not yet packed or shipped, oldest first |
| `orderDetails` | `number` | One order: status, payment, shipping, total, items, first name; no contact details |
| `abandonedCheckouts` | `days` (1 to 30) | Carts that left contact details but did not order |
| `lowStock` | `threshold`, `limit` | Tracked variants running out |
| `findProducts` | `search`, `tag`, `collection`, `limit` | Products with handle, price, stock, status |
| `productDetails` | `product` (handle best, or title) | One product's fields |
| `listCollections` | none | Collections with type and product count |
| `customerDetails` | `email` or `order` (number) | Name, email, phone and order count; only while "Let clients read customer details" is on |

### Change tools (listed only while "Allow AI clients to make changes" is on)

Each runs at once with the member's role, unless the role ticks "Needs approval" for its
permission; then it waits in Approvals. **Confirm with the merchant before every call.**

| Tool | What it does |
| --- | --- |
| `proposeDiscount` | A new discount code: `code`, `type` (`percent`, `amount`, `freeShipping`), `value`, scope (store, collections or products), optional dates |
| `proposeCollection` | A new manual collection, or products added to an existing manual one (at most 200); can be undone |
| `proposePriceChange` | Percent price change for products in a collection, with a tag, matching a title or named (at most 200 variants); shows old and new prices; can be undone |
| `proposeProductUpdate` | One product's title, description, search title, search description or tags; can be undone |
| `proposeOrderNote` | An internal note on an order's timeline, or a reply draft saved as a note; never sends to the customer |

### Every other admin action (always listed)

| Tool | Input | Use |
| --- | --- | --- |
| `searchActions` | `query`, optional `area` | Up to 20 admin actions: `path` (for example `orders.fulfil`), one line, kind, area |
| `describeAction` | `path` | Input JSON Schema, output hint, kind, `needsApproval` (`no`, `always`, `blocked`) |
| `runAction` | `path`, `input` | Runs it as the member, or queues it for approval |

Kinds:

- **read**: runs at once.
- **write**: runs at once with the member's role (queued if the role ticks "Needs approval").
- **sensitive**: always queued for a person in the admin, even for the owner. Refunds, store
  credit, cancellations, deletes and removes, gift card money, payment keys and settings, staff
  and roles, billing, domains, store export and deletion, MCP & API settings. Cancelling through
  `orders.setStatus` counts as sensitive.
- **excluded**: never listed or run (account, sign-in, tokens, deciding approvals, browser
  hand-offs such as gateway sign-in or uploads).

Examples of real paths (check with `describeAction` before use): `orders.list`, `orders.get`,
`orders.addNote`, `orders.fulfil`, `orders.createShipment`, `orders.setStatus`,
`shipments.quote`, `shipments.label`, `products.update`, `inventory.edit`,
`deliveryOptions.tryPin`, `storeCredit.get`.

Limits: input over 32,000 characters is refused, answers over 20,000 characters are cut, 30
seconds per call, 120 calls a minute per connection. Proposals expire after 24 hours; queued
approvals after 7 days.

## Public store endpoint: `POST https://<store domain>/api/mcp`

Read-only, no sign-in, for agents shopping on a shopper's behalf. Off when the store is
password-locked or AI crawlers are off. Shows only what the store's Agentic sales controls allow.
60 calls a minute per IP.

| Tool | Input | Returns |
| --- | --- | --- |
| `search_catalog` | `query` (2 to 100 characters), `limit` (1 to 10) | Products: title, URL, brand, price in INR, availability, variants |
| `get_product` | `handle` (handle or full product URL) | Description, every variant with price and stock |
| `search_policies_and_faqs` | `query` | Answers from the store's published knowledge base and policies |
| `get_store_info` | none | What the store is, brands, where it ships, policy links |

No checkout over MCP: send the shopper to the product URL to buy.
