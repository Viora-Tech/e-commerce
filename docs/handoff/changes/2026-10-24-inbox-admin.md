# Inbox PR 4: the admin inbox (home, conversations, customer panel, sidebar, bell)

**Branch** `feat/inbox-admin`, stacked on `feat/inbox-settings` (PR 3). Design §6 and §12 (Shopify Inbox
screenshots). No migration.

- **Sidebar**: Inbox sits under **Sales channels** while installed (manifest `admin.salesChannel`;
  `lib/nav-channels.ts` `withSalesChannels`), with Conversations, Quick replies and Settings, and the unread
  count on Conversations (`inboxUnreadCount` in `lib/shell-data.ts`). It is no longer listed under Apps.
- **Inbox home** `/sales-channels/inbox`: the email banner (contact capture off), to-dos (add hours, first
  quick replies), the Staff card (hours with Available now / Away, contact capture or Sign-in required,
  quick replies), Active status with Preview store, and the last 30 days (conversations, messages, median
  first reply, answered). The AI agent card arrives with PR 6; assisted orders with PR 9.
- **Conversations** `/sales-channels/inbox/conversations?id=&view=`: three panes. Left: Open, Closed, then
  Assigned to me, Unassigned, Unread (new view in core), Blocked, with Quick replies and Settings at the
  bottom. Middle: search and rows (avatar, name, preview, time, unread dot, assignee); "All clear" with
  "View closed conversations". Right: the thread (header with status, Assign, Close/Reopen, More: Copy link,
  Block/Unblock with a confirm), messages with notes, product/discount/image cards, cart and system lines,
  Seen and Typing marks, older pages on demand, and the composer (`/` quick replies, Note switch, Share
  products dialog up to 3, Share a discount code dialog with active codes only, image upload). The customer
  panel is inline on wide screens and a dialog below; on phones one pane at a time with Back. No drawers.
- **Live**: `hooks/use-inbox-live.ts` runs `connectInbox` on `/api/inbox/stream`, polling `inbox.sync`
  every 4 s while the tab is visible when the stream does not get through.
- **API/core**: `inbox.panel` (verified customer, or a possible match by typed email with an Unverified chip
  and no orders; live cart; recent orders only with `orders.read`), `inbox.assignees` (owners and roles with
  `inbox.reply`), `inbox.metrics`, `inbox.shareableDiscounts`, `inbox.cards`; `inbox.get` returns the cards
  its messages point at. Core `inbox/panel.ts`.
- **Bell**: an Inbox row ("N chats waiting for a reply") for members with `inbox.read`.
- **Copy** `data/inbox-conversations.ts` + Hindi; page names in `data/layout.ts` and `data/hi/navigation.ts`.
