# Inbox PR 2: realtime (SSE over Redis pub/sub) and the polling fallback

**Branch** `feat/inbox-realtime`, stacked on `feat/inbox-core` (#732). Design
`docs/superpowers/specs/2026-10-24-inbox-design.md` §4.

- **Hub** `packages/core/src/inbox/realtime.ts`: one Redis subscriber connection per Node process
  (`@commerce/queue` `inboxHub`, its own connection, never `sharedRedis`), channels subscribed by
  reference count, at most 2,000 streams per process; a subscribe that does not answer in 3 s, a
  full process, or no Redis answers **503** ("poll instead").
- **Stream** `inboxStreamResponse`: subscribes first and holds live events while it replays from
  Postgres after `Last-Event-ID` (or `?after=`), starting 5 s early (`replayFloorId`, UUIDv7 ids
  sort by time) so a write that committed out of order is not missed; each message is sent once.
  `event: ready` on connect, `event: ping` every 20 s (Cloudflare closes idle streams after 100 s;
  EventSource cannot see comments). Headers `Cache-Control: no-store, no-transform` and
  `X-Accel-Buffering: no`. No Postgres connection is held while a stream is open.
- **Events** `events.ts`: staff get everything on `inbox:{storeId}`; a shopper's `conv:{id}` never
  carries notes, staff ids, or anything from a spam-blocked thread. Typing and seen marks go to the
  other side. `inboxSync` is the admin poll.
- **Publishing after commit**: store procedures now carry `context.afterCommit(fn)` (run after
  `withStore` commits; failures reported, never thrown). The Inbox router publishes send, seen,
  assign and status changes through it with `context.inboxPublisher` (admin `apiHost`).
- **API** `inbox.sync` (read), `inbox.typing` (one per 3 s, never stored), `inbox.streamAccess`
  (the stream route's check). MCP excludes `typing` and `streamAccess`.
- **Routes**: admin `GET /api/inbox/stream`; storefront `GET /inbox/stream` and
  `GET /inbox/poll?after=` (`app/-s/[storeId]/inbox/[action]`, the shopper's own conversation
  only, poll rate-limited per IP and store), helpers in `apps/storefront/src/lib/inbox.ts`.
- **Browser** `@commerce/core/inbox` `connectInbox`: EventSource with a watchdog; switches to
  polling every 4 s (while active) when no frame arrives within heartbeat + 10 s, after 3 errors in
  a row or on a 503, and tries the stream again every 5 minutes. Used by PR 4 and PR 5.
- **Tests**: hub fan-out with a fake Redis, the cap, replay-then-live without duplicates, 503,
  the browser fallback with a fake clock and EventSource, channel routing, replays, `inbox.sync`,
  publish-after-commit (nothing published when the write fails), typing throttle.

## For the coordinator (production, not done here)
- Check streaming through the edge on vioratech.in: `curl -N https://<store>.vioratech.in/inbox/stream`
  (with a `wc_chat` cookie of a real thread) and `/api/inbox/stream` on the admin should print
  `event: ready` at once and `event: ping` every 20 s. If frames arrive in one burst, Traefik's
  `commerce-compress` is buffering: give `PathPrefix(/inbox/stream)` and `/api/inbox/stream` their
  own router without the compress middleware.
- Cloudflare: exclude `/inbox/*` from the store-page cache rule.
