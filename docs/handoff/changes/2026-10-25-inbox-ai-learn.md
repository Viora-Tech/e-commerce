# Inbox AI agent: learns from the team's replies (PR 3 of 3)

- Before answering, the agent looks up earlier shopper questions in other chats that share words
  with this one, pairs each with the first staff reply after it, and sends up to 3 pairs as
  PAST TEAM ANSWERS (`loadPastAnswers` in `packages/core/src/inbox/ai-agent.ts`). Most words in
  common first, then newest; one pair per chat; notes and cards are never examples.
- The prompt follows their tone and promises, but STORE DATA wins on prices, stock and dates.
- Setting `ai.learn` (default on): Inbox → Settings → AI agent → "Learn from your team's replies".
- Migration `0167_inbox_message_store_sender`: index `(store_id, sender, id)` on `inbox_message`
  for the look-up.
