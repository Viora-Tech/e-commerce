# Drafts unseen count in the sidebar (#1442)

- Migration `0235_member_drafts_seen`: `store_member.drafts_seen_at` (nullable).
- `packages/api/src/services/drafts-seen.service.ts`: `unseenCheckoutDrafts` counts open checkout
  drafts (status draft, source checkout, not expired) with `last_activity_at` after the member's
  `drafts_seen_at` (null: all of them). `markDraftsSeen` stamps now and returns how many it cleared.
- `store.shell` returns `drafts` (needs drafts.read); the admin layout shows it on Orders › Drafts.
- Opening Drafts (`MarkDraftsSeen` in `orders/drafts/page.tsx`) calls `orders.markDraftsSeen`
  and refreshes the layout only when something was cleared.
- A shopper checking out the same items again bumps `last_activity_at`, so that draft counts again.
