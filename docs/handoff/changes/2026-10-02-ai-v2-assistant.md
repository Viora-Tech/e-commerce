# AI v2: one assistant on every page, changes with approval, bulk Write with AI

**Branch** `feat/ai-v2-assistant` from `main` (after #231 AI engine, #230 GST, #232 checkout).
**Migration `0086_ai_v2_assistant`** (`when` 1791160000000, prevId chained to `0084_snapshot`;
0085 is reserved for the theme import build: if it lands first, re-check the journal order and
re-chain `0086_snapshot.json`'s `prevId`). Tables `ai_action`, `ai_job`, `ai_job_item` (store_id,
`apply_store_rls()`), column `ai_settings.writing_quality`.

- **AI bar on every admin page** (`apps/admin/src/components/assistant/`, mounted in
  `admin-frame.tsx`): a pill at the bottom centre (round button on phones), **⌘J / Ctrl+J**
  toggles it with no animation, Esc inside closes. Knows the page (`pageContextFor`, the record id
  resolved under RLS on the server) and offers page chips. Streams answers; conversation per tab
  and store in sessionStorage (`hooks/use-assistant.ts`); "AI can make mistakes" note. Hidden
  under a save bar (`data-save-bar`). `openAssistant(prompt)` (`lib/assistant-events.ts`) opens
  it from anywhere. Home's "Ask your store" card is replaced by **Ask AI** (suggestions that open
  the bar); `ai.ask` and the ask-store service are gone (the assistant covers them).
- **Changes with approval**: write tools are engine `risk: 'propose'` tools. Each one
  (`packages/api/src/services/ai/assistant/actions/*.ts`) validates, resolves names under RLS and
  stores an `ai_action` row (`proposed`) with a preview card. Approve / Edit / Cancel /
  Undo via `ai.approveAction`, `reviseAction`, `cancelAction`, `undoAction`: only the asker may
  approve, the role's permission is checked again, it runs in a savepoint in their RLS
  transaction, and the result and undo info are logged. Tools: discount, price change (exact
  prices shown, MRP cap, undo), manual collection (new or add), product text (title, description,
  SEO, tags), order note or reply draft (never sent). Read tools: sales, top products, stock,
  orders to ship, abandoned checkouts, find products, product details, collections, order
  details. Limits in `ASSISTANT_LIMITS`: 200 items, 3 proposals per message, -50%..+100%, 60 min
  expiry; no delete, payment, refund or messaging tools.
- **Safety**: `guardData` hides store text that tries to instruct the AI and taints the message
  (later proposals carry a warning); `DATA_RULES` in every prompt. Only PII sent is an order's
  customer first name (said under the answer); customer notes have phones and emails hidden.
- **Bulk Write with AI**: products list → select → Write with AI → worker job `{ai}-bulk-write`
  (`QUEUE_LIMITS.aiBulkWrite`, one product at a time per store), progress banner, per-product
  review, Apply logs an undoable `ai_action` (`applyProductCopy`). Core: `ai/jobs.ts`,
  `ai/bulk-write.ts`, `ai/product-fields.ts`; `@commerce/core/ai-runtime` subpath (admission,
  photos, runner: the SDK stays off the core barrel). Product copy schema gained `altTexts`.
- **Model routing**: `MODEL_TIERS` fast (Haiku 4.5, `AI_MODEL`) and strong (Sonnet 4.5,
  `AI_MODEL_STRONG`); Settings → AI "Writing quality" Best moves writers to strong and counts 3
  requests per write. Features now `productWriter`, `assistant`, `bulkWriter` (a stored
  `askStore: false` keeps the assistant off).
- **Settings → AI**: new switches, writing quality, **Activity** card (every AI change, who
  approved, Undo). Settings nav untouched.
- `canAny` / `canDetached([...])` in procedures: any-of permission gates for the assistant and
  approvals (each action re-checks its own permission). Documented in the guardrails router idiom.
- **Tests**: `packages/api/test/ai-assistant.test.ts` (gating, edit/cancel/expiry, permission per
  tool, limits, price undo, collections, Hindi product update, injection guard, cross-store, bulk
  run/apply/undo, feature off); `packages/ai/test/assistant.test.ts` (guard, prompt, page context,
  mock planner). Leak test: `ai.assistant`, `ai.bulkWrite` skipped (model provider), action and
  bulk procedures walked with id hints.
- **Docs**: developer docs Building → AI assistant (how to add a tool as one slice), AI engine
  updated (routing, propose risk); merchant guide **AI assistant** page and Settings → AI.
- **Next**: AI setup wizard (guided store setup), theme editor AI, storefront smart search
  (embeddings), more tools (inventory adjustments with approval, blog and collection writers).
