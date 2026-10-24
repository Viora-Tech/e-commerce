# Inbox PR 1: tables, core services, permission, API

**Branch** `feat/inbox-core`, from `dev`. First of the Inbox PRs (our Shopify Inbox; design
`docs/superpowers/specs/2026-10-24-inbox-design.md`, copied in by this PR with the owner's answers in §0).

- **Migration `0161_inbox`** (idempotent): `inbox_conversation`, `inbox_message`, `inbox_quick_reply`,
  `inbox_block`, `member_push_subscription`, all forced RLS on `store_id` (`apply_store_rls()`). One open
  thread per browser (partial unique index), one copy per resend (`(conversation_id, client_id)` unique).
  Seeds `inbox.read/reply/manage` onto system Admin roles, and `inbox.read/reply` onto every role that holds
  `customers.write`.
- **Schema** `packages/db/src/inbox-schema.ts`. Staff columns hold the Better Auth user id
  (`assignee_user_id`, `member_user_id`). Blocks are `kind` + `value_hash` (visitor cookie hash, HMAC of the
  email, HMAC of the IP; IP blocks expire after 30 days). Contact phones are encrypted like `customer.phone`,
  with a blind index on the last 10 digits.
- **Permission** `inbox: ['read', 'reply', 'manage']` (`INBOX_READ/REPLY/MANAGE`). New stores: Admin gets all
  three through `ADMIN_PERMISSIONS`; Staff gets none.
- **Core** `@commerce/core/inbox` (pure: word lists, settings + availability in the store zone, access and
  spam rules) and `@commerce/core/inbox/server`:
  - `messages.ts` `appendMessage` (one writer: preview, unread counters, first response), `messagesAfter`
    (the realtime replay after a message id), `threadPage`.
  - `conversations.ts` staff side: list with Open/Mine/Unassigned/Closed/Blocked and search (name, email,
    phone, a word in the thread, order number), counts, get, `staffSend` (text, note, product card ≤ 3
    active products, active discount code, image), seen, assign, close/reopen/block (blocking also blocks
    the browser and email; unblocking lifts them).
  - `shopper.ts` storefront side: `canShopperAccess` rule (a customer's thread is theirs alone; a guest's
    opens with its cookie), `shopperSend` (sign-in switch, blocks, rate limits, spam on the first message),
    `mergeGuestConversation` (sign-in), `postCartEvent`, `markShopperSeen`.
  - `quick-replies.ts`, `blocks.ts`, `limits.ts` (per-store keys: 5 new threads/IP/hour, 10/min and 60/hour
    per thread, 5 images/hour, staff 60/min), `state.ts` (installed + settings in `store.apps.settings.inbox`).
- **API** `inbox.*`: counts, list, get, send, markSeen, assign, setStatus, quickReplies.*, blocks.*,
  settings.get/save. Refuses until the app is installed (the manifest comes in PR 3). MCP: area
  `customers`; `inbox.send` is sensitive (always waits for approval). MCP action docs regenerated.
- **Tests** core `src/inbox/*.test.ts` (40), api `test/inbox.test.ts`.
- **Not in this PR**: realtime and `inbox.sync` (PR 2), manifest/settings pages (PR 3), the admin inbox
  (PR 4), the widget (PR 5), notifications (PR 6), privacy/retention (PR 7), sales channel and order
  attribution (PR 8). Exports those PRs read are allow-listed in the no-orphans sweep until then.
