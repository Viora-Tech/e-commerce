# Invited staff no longer loop on the store picker (2026-10-05)

On the test deploy an invited teammate who accepted their invitation opened the admin, landed on
`/select-store`, chose the store, and was sent straight back to the picker, forever, with nothing
in the server log. The owner was fine.

- **Root cause.** The admin home guarded with `store.current`, which is `can(settings.read)`, and
  `.catch(() => null)` + `redirect('/select-store')` on any error. The owner passes every
  permission check (`isOwner`), so only non-owners could fail it: the system **Staff** role (and
  any custom role) has no `settings.read`, so `store.current` refused with `FORBIDDEN`, the catch
  swallowed it (an `ORPCError` thrown in the guard is never reported), and the picker sent them
  back. An Administrator who accepted through our page reads `store.current` fine in tests.
- **Second cause, same symptom.** A member with no `store_member` row yet (joined through Better
  Auth directly, or predating roles) is healed by `resolveAccess` on their first store call. One
  admin page load makes several store calls at once (layout `apps.list`, `themes.list`, accent,
  page); each ran `seedSystemRoles` concurrently and all but one failed on role_permission's
  unique key. The heal now takes a per-store transaction advisory lock (`lockMembershipHeal`,
  `packages/core/src/permissions/service.ts`) and re-reads the member first
  (`packages/api/src/procedures/store.ts`).
- **No more silent loop.** `findMembership` marks its "no store to work in" errors (no active
  organization, not a member incl. Better Auth's own refusal, no store) with
  `data.reason: 'no_store'`; `isNoStoreError` (exported from `@commerce/api`) recognises them.
  Admin helper `orNoStore(fallback)` (`apps/admin/src/lib/store-guard.ts`) returns the fallback
  for those and rethrows everything else to the error page (and Sentry via `onRequestError`). The
  home page and all 14 pages that did `.catch(() => undefined)` + `redirect('/select-store')` use
  it. A bad id or a missing permission on those pages now shows the error instead of the picker.
- **Home guard.** The home page checks membership with `staff.me` (every role passes) instead of
  `store.current`; its value was never used.
- No migration.

Tests: `packages/api/test/invitations.test.ts`, "opening the store after accepting (store picker
loop)": invited Administrator reads `store.current` on first and later loads; a Staff member
passes `staff.me` and their `store.current` refusal is not a no-store error; no active store and
removed member are no-store errors; four concurrent first calls for a role-less member all
succeed. Docs: developer `building/request-flow.mdx`.

If the teammate on the test server is an Administrator and still cannot get in after this
deploys, the home page will now show the real error (and report it) instead of looping.
