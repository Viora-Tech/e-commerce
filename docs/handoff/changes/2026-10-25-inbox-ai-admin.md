# Inbox AI agent: admin controls (PR 2 of 3)

- **Inbox → Settings → AI agent** (`components/inbox/ai-agent-settings.tsx`): when the AI answers
  (Off / Only while you are away / Every chat until your team replies) and "What the AI should
  know" (up to 4,000 characters). Default stays Off.
- **Needs a person** view (`needs_person` in `INBOX_VIEWS`) with its count in the rail, listing open
  chats the AI handed off. List rows show a "Needs a person" badge and an `AI:` preview prefix.
- **Thread**: a hand-off banner with the AI's summary; AI messages are labelled "AI agent".
  Replying (not a note) takes over: `needs_human` clears on a staff reply and on close.
- `ConversationSummary` carries `needsHuman` and `handoffSummary`.
- Copy in `data/inbox.ts`, `data/inbox-conversations.ts`, with Hindi overlays.

Next: PR 3, training the AI from the store's past staff replies.
