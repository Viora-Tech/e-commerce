# Inbox chat emails: missed replies, transcripts, chats waiting (22 Nov 2026)

Owner ask: "I want the conversation chat email also to users or admins".

## What sends, and when

A worker sweep (`inbox-chat-emails`, every 2 minutes, `apps/worker/src/inbox-chat-emails.ts`)
calls `sendInboxChatEmails` (`packages/core/src/inbox/chat-emails.ts`) for every store with a
chat touched in the last day (`stores_with_inbox_chat_emails()`, migration 0265). Timing rules
are pure in `packages/core/src/inbox/chat-email-rules.ts`:

- **`chat_reply` (to the shopper)**: the store (a person or the AI agent) wrote last, the shopper
  has not opened the widget since (`unread_shopper > 0`) for 5 minutes. At most one per chat per
  30 minutes; later replies batch into the next one. Shows the last 10 lines.
- **`chat_transcript` (to the shopper)**: the chat was closed 2+ minutes ago, the store answered
  in it, and the shopper has not already had its latest message by email. The whole chat (60
  lines, "N earlier messages not shown" beyond that).
- **`staff_chat_waiting` (to team members)**: the shopper wrote last (a new chat or a follow-up),
  nobody opened it (`unread_staff > 0`) for 5 minutes. At most once per chat per 30 minutes. One
  email per member listing up to 10 chats with their last 3 shopper lines and a Reply link. An
  assigned chat goes only to its assignee; unassigned ones to everyone with Inbox read access.

Shopper emails go to the customer's account email, else the email they typed in the widget; no
email, no send. Team notes, system lines and cart events never appear. Nothing about chats quiet
for over a day, blocked, or anonymised. Each chat is claimed (`shopper_emailed_at` /
`unanswered_alerted_at` moved in the checking statement) before sending, so overlapping sweeps
never double-send. Email only.

"Continue the chat" links to `https://<store>/?chat=open`; the launcher now opens the chat on
that query (`apps/storefront/src/components/inbox/inbox-launcher.tsx`). A guest on another
device starts a new thread (the chat cookie is per browser).

## Settings

- Settings → Notifications: `chat_reply` and `chat_transcript` (Apps group, switchable),
  `staff_chat_waiting` (team group, switchable store-wide). Copy in `data/notifications.ts` + Hindi.
- Account → Notifications: the existing "New Inbox message" **email** switch controls the team
  email. Its default is now **on for the owner** (was off); staff still opt in. Help text says
  it waits 5 minutes and skips opened chats.
- Not done: the Inbox app's "Email when you have not replied" acknowledgement
  (`emailFallbackMinutes`) is still unimplemented; untouched.

## Code

- Templates: `packages/notifications/src/chat-types.ts`, `templates/content-chat.ts`,
  `templates/compose/chat.ts` (quote blocks per message, store lines in the accent),
  `samples-chat.ts`; registered in `template-ids.ts`, `templates/index.ts`, `content.ts`,
  `compose/index.ts`, `internal.ts`, `content-footer.ts`, `samples.ts`; WhatsApp params in
  `notifications-whatsapp/src/whatsapp.ts` (listed for completeness, email only).
- Migration `0265_inbox_chat_emails.sql` (additive): `inbox_conversation.shopper_emailed_at` and
  the SECURITY DEFINER store lister. Journal `when` 1795281300000.

## Tests

- `packages/notifications/test/chat.test.ts` (composer, plain text, escaping, subjects).
- `packages/core/src/inbox/chat-email-rules.test.ts` (debounce and seen rules, pure).
- `packages/core/src/inbox/chat-emails.test.ts` (database: once only, assignee only, no notes).
- `packages/core/src/member-account/alert-prefs.test.ts` updated for the owner default.
