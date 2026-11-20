# Source column on the drafts and abandoned checkouts lists

Follow-up to `2026-11-18-sale-source-drafts-checkouts.md`, which already put the "Where it came
from" card (`components/orders/sale-source-card.tsx`) on the checkout draft, staff draft and
abandoned checkout pages, plus a Source column on the abandoned list. Branch
`feat/source-on-drafts-abandoned`. **No migration**: carts and checkout drafts already store the
touch (`cart.attribution`, copied onto the draft's `order.attribution` at checkout, also when the
same shopper checks out again).

- **Drafts list**: a new Source column. A staff draft says "Admin"; a checkout draft names where
  the shopper came from.
- **Both lists name the channel as the card does**: an AI agent or social channel by name
  (ChatGPT, Instagram, through `orderChannel`), else the marketing channel (Paid search, Email),
  else "Not tracked". Before this, the abandoned list showed only the marketing channel, so a
  ChatGPT visit read "AI assistant" in the list but "ChatGPT" on the page.
  `saleSourceLabel` in `apps/admin/src/lib/sale-source.ts`.
- **API**: `listDrafts` and `listAbandoned` items carry `touch` (`ListTouch`: channel, plus UTM
  source / medium and referring host when recorded; null when nothing was recorded), built by
  `listTouch()` in `packages/core/src/marketing/list-touch.ts`. The campaign, first page and
  visit time stay on the detail pages. `listAbandoned` keeps `channel` for its filter.
- Copy: no new strings (`saleSourceContent.column`, `.admin.channel` and `.channels` already have
  Hindi).
- Tests: `packages/core/src/marketing/list-touch.test.ts` (DB), `apps/admin/src/lib/sale-source.test.ts`.
- Not done: a Source filter on the drafts list (the abandoned list has one). Add it if wanted.
