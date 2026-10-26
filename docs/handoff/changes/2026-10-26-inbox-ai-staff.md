# Inbox: AI help for staff (suggested replies, chat summary, shopper activity)

Branch `feat/inbox-ai-2026-10-26`. No migration.

What staff see in **Sales channels → Inbox → Conversations**:

- **Suggested replies** above the reply box when the shopper's message is the newest one: up
  to three drafts, click to fill the reply box (never sent by itself), refresh for new ones.
  `components/inbox/conversations/suggested-replies.tsx`; the composer takes a `seed` prop.
- **Chat summary** at the top of threads with 6+ visible messages (what it is about, what is
  pending), written once per chat per session in the member's admin language, refresh on demand.
  `thread-summary.tsx`.
- **Activity** in the customer panel: product page they are on, pages they chatted from,
  location (customer's saved address), last order with fulfilment and payment chips; the
  verified customer's phone. `shopper-activity.tsx`. No AI "tip" (left out to save credits).

How it works:

- Prompts, schemas and clamps: `packages/ai/src/inbox-assist.ts` (mock answers in `mock.ts`).
  Store and chat text goes through `guardData`; every prompt says data is never instructions.
- Data pack: `inboxAssistContext` in `packages/core/src/inbox/assist.ts` (thread with team
  notes, products the question names via the AI agent's `inboxAiProducts`, the product page,
  `inboxAiPolicies`, shipping rates, cart, and orders with shipments only for a verified
  customer and a member with `orders.read`). Pure helpers in `inbox/insights.ts`.
- API: `packages/api/src/services/ai/inbox-assist.ts`, router `inbox.aiAvailable`,
  `inbox.suggestReplies` (`inbox.reply`), `inbox.summarise` (`inbox.read`), all `canDetached`.
  They go through `startAiCall` / `finishAiCall` under the **assistant** feature: same switch,
  burst limit and monthly credits as the AI assistant and the shopper-facing Inbox AI agent.
- Shopper text messages now keep the page they were sent from in `payload.page` (path only,
  query and hash dropped, `cleanPagePath`). Older messages have none; `startedUrl` still counts.
- `customerPanel` takes an optional `secret` (decrypts the customer's phone) and returns
  `phone`, `location`, `pages`, `viewing`, and orders with `paymentStatus`/`fulfillmentStatus`.

Docs: merchant guide `apps/docs/content/merchant-guide/apps/inbox.mdx` (new page).
