# Inbox: thread header no longer squeezes the shopper name

- Inbox → Conversations, thread header (`apps/admin/src/components/inbox/conversations/thread-header.tsx`).
  At 1280–1440px with the customer panel open, the name shrank to "G…" because the name block was
  `flex-1 min-w-0` (basis 0) and lost every pixel to the badge, Assign, close circle and More.
- Now: the name block is `flex-1 min-w-32` (keeps ~10 characters, truncates past that, full name in
  `title`); the status chip (and the spam note) moved to a second line under the name; the controls
  group is `shrink-0`, and when the header is too narrow it wraps below the name (the header already
  had `flex-wrap`) instead of squeezing it. A long assignee name on the Assign button truncates at 7rem.
- No copy changes; no `packages/ui` changes.
