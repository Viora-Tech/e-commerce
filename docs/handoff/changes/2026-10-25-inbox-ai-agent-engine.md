# Inbox AI agent: engine (PR 1 of 3)

The Inbox chat can now be answered by an AI agent from the store's own data. The engine and the
worker are in place; the merchant switch (Settings → AI mode, store notes) lands in PR 2, so every
store is `mode: 'off'` until then and nothing changes for shoppers.

- **Settings**: `InboxSettings.ai = { mode: 'off' | 'all' | 'away', knowledge }` (default off).
  `away` answers only while staff show as away.
- **Rules** (`packages/core/src/inbox/ai-rules.ts`, pure): `aiMayAnswer` (off, closed, handed off,
  or a staff reply = quiet) and `asksForHuman` (English, Hinglish, Devanagari).
- **Prompt** (`packages/ai/src/inbox-agent.ts`): answers only from products matched by the question,
  published policy pages, the merchant's notes and the signed-in shopper's last 5 orders. Never
  invents prices, stock or dates; product cards are limited to products it was shown.
- **Run** (`packages/core/src/inbox/ai-agent.ts`): `runInboxAiReply` posts the reply (sender `ai`,
  plus a product card) or hands off: a short line to the shopper, `needs_human`, `handoff_summary`,
  `handoff_at` on the conversation. Confidence under 60, a model failure or an ask for a person
  hands off. Counted under the `assistant` AI feature; every outcome is logged in `inbox_ai_event`.
- **Queue**: the storefront's `sendChatAction` queues `{inbox}-ai-reply` for each non-spam shopper
  message (job id per message, 3 attempts); `apps/worker/src/inbox-ai-reply.ts` runs it and
  publishes the realtime events.
- **DB**: migration `0166_inbox_ai` (conversation columns + `inbox_ai_event`).
- AI messages now count as unread for the shopper (`appendMessage`).
- Also: brand-name literals in `apps/admin/src/data/sales-channels.ts` read `siteConfig`.

Next: PR 2 admin AI settings + Needs-human view and take-over; PR 3 training from past replies.
