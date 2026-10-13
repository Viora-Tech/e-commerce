# Activity bell in the top bar

The bell was a placeholder ("Nothing to catch up on"). It now shows two sections:

- **Needs your attention:** each count links to where it is handled.
  - Payments to refund (captured with `refund_needed`: paid twice, or paid after cancelling).
  - Return requests to review.
  - Items out of stock, and items running low (tracked variants of active products against the store's low-stock
    threshold, summed over locations).
  - Photos that failed processing.
- **Last 7 days:** new orders, refund flags and return requests, newest first, at most 25. Each opens its order or return.

**How it's built:**
- Read from the data itself (`packages/core/src/activity/feed.ts`), with no table of its own, so it can't disagree with
  the pages it links to.
- `activity.feed` uses `canAny([orders.read, inventory.read, content.read])`, then shows each part only with its own
  permission.
- Refreshed every minute while the tab is visible.
- **The dot:** red means new events since this member last opened the bell. "Seen" is kept per member in this browser's
  localStorage, a convenience only. Amber means only attention items.

**Not yet:**
- Shopify import runs finishing or failing (their table lives in the plugin; needs a plugin hook).
- Worker/job failures.
- Push or email for these.
