# One `set_config` per admin call

Every store procedure opens its own transaction: `begin`, `set_config('app.store_id')`, then a
second statement `set_config('app.actor_name')`, the call's queries, `commit`. A simple admin page
makes about 28 such calls (layout, page, client reads), so it ran about 28 extra round trips just
for the actor name.

- `withStore` (`packages/db/src/with-store.ts`) takes `actorName` next to `catalogId` and sets
  every setting in one `select set_config(...), set_config(...)`.
- `storeProcedure` passes the member's name there; `services/actor.service.ts` (`setActorName`) is
  gone. The actor name is now set before the approval and step-up checks instead of after them;
  it only feeds column defaults (stock history), so nothing written changes.
- No migration, no new env keys.
