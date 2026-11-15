# Sidebar: the Inbox row shows its unread count

The unread-chats count sat only on Inbox › Conversations, so a closed Inbox section showed no
number (the owner expected "Inbox 2", as Orders shows "Orders 58"). The layout now puts the
same count on the Inbox row too, and count pills say what they count: `NavItem.countKind`
(`unread` for Inbox, `unreadHint`), orders waiting to ship by default.

Also sorts `packages/core/src/index.ts` exports (lint error from #1745).
