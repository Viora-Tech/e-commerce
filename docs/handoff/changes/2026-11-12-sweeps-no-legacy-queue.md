# Sweeps added after the shared queue have no old queue (12 Nov 2026)

After the 12 Nov release the worker logged "could not delete old sweep queue" every boot for
`store-credit-expiry` and `refund-sync`. Both sweeps were added after the move to the shared
sweeps queue, so they never had a queue of their own, but they still listed a made-up `legacy`
queue without a `{hashtag}`; Redis refused BullMQ's obliterate script on those keys.

- `Sweep.legacy` is optional (`apps/worker/src/sweeps.ts`); a sweep without one skips reading,
  removing and deleting an old queue.
- `store-credit-expiry` and `refund-sync` drop their `legacy` entry and the two unused
  `*_QUEUE` constants.
- Test: a sweep with no legacy queue touches no old queue.
