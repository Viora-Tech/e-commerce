# Admin reads the page again when the merchant comes back to the tab (#1410)

The admin keeps no client cache: pages are server components and only update on
`router.refresh()`, so new orders showed only after a reload.

- `components/layout/refresh-on-focus.tsx`, mounted once in `app/(admin)/layout.tsx` (with a
  store): when the tab becomes visible again or the window regains focus, it calls
  `router.refresh()` if the page was last read 30 s or more ago. A server-component refresh keeps
  client state (open menus, typed text, scroll).
- The rules live in `lib/focus-refresh.ts` (`shouldRefresh`): no refresh while offline, while a
  dialog is open (`[role=dialog]`, `[role=alertdialog]`), or while a form has unsaved changes
  (every `LeaveGuard`, so every `SaveBar`, holds it with `holdForUnsaved`). Live view
  (`/analytics/live`, polls every 15 s) and `/dev/editor` are skipped. The theme and code editors
  are in the `(editor)` layout and never mount it. Focus going into an iframe and back does not
  count as coming back.
- A navigation counts as fresh, and so does a page's own poll: the campaign report's 5 s refresh
  while sending calls `noteRefreshed()`, so there is no double fetch.
- Lists that hold their rows in client state miss a plain refresh. They listen for the
  `admin:refresh` window event (`ADMIN_REFRESH_EVENT`); the Orders list does now. Other lists can
  opt in the same way.
- Later option for client-heavy live pages: TanStack Query via `@orpc/tanstack-query`. Not added.
- No new dependency, no migration. Test: `apps/admin/src/lib/focus-refresh.test.ts`.

## Test

Open Orders, switch to another tab for over 30 s, place a test order on the storefront, come back:
the new order shows without a reload. Come back within 30 s: no request. Type in a settings form
(save bar showing), leave and come back: nothing re-reads.
