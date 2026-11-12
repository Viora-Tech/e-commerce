# Roles: saved permissions always show, and a clearer role page and roles list (12 Nov 2026)

Issue #1623. Branch `fix/roles-page-redesign`.

## Bug: a role reopened with its old permissions

- The owner set Administrator to Allowed everywhere and saved (`needsApproval: []` on the
  server); reopening the role showed Ask first again until a full reload.
- Cause: `RoleEditor` saved and then only `router.push`ed to the list. Nothing dropped Next's
  client copy of the role page, and the editor seeds its form from `initial` with
  `key={role.id}`, so even a fresh server read of the same role (`router.refresh()`, the focus
  refresh) kept the old form state (`router.refresh` keeps `useState`).
- Fix:
  - `app/(admin)/settings/staff/actions.ts`: server action `revalidateStaff()` runs
    `revalidatePath('/settings/staff', 'layout')`, which also clears the browser's router cache.
    The editor calls it after every save, then `router.push` + `router.refresh()`. A role delete
    calls it too.
  - `roles/[id]/page.tsx` and `staff/page.tsx`: `dynamic = 'force-dynamic'`.
  - The editor's key is `roleEditorKey(role)` (`role-access.ts`): id plus name, description,
    grants and ticks, so a read that differs mounts a fresh form.
  - Roles list links use `prefetch={false}`; the Staff page reloads the team on the admin focus
    refresh (`ADMIN_REFRESH_EVENT`).
  - Unsaved edits on a role page carry a `LeaveGuard`, which also holds back the focus refresh.

## Role page redesign

- One table per area (`role-area-table.tsx`): rows are permissions, three radio columns
  Off | Allowed | Ask first, one filled dot per row (Allowed green, Ask first amber, Off muted).
  Rows that can never ask (reads, approving) show "–" under Ask first. Native radios, one group
  per row labelled "Area Permission", so arrow keys work.
- Per area: Allow all, Ask first for all, Turn all off. The rules live in `role-access.ts`
  (`canPick`, `pickLevel`, `pickAreaLevel`): a built-in role never gains or loses a grant, only
  the owner moves Ask first, the owner role has no Ask first column.
- A sticky bar at the bottom (`role-summary-bar.tsx`): "N allowed · N ask first · N off" and the
  one Save (it replaced the header's Save).

## Roles list

- Whole row opens the role; the role name is a link; "Edit permissions" (or "View permissions"
  when the member can change nothing) is an outlined button at full strength, not the faint
  row-actions cell. Delete is an icon button. Phones get a chevron instead of the button.
- Each role shows "● N allowed ● N ask first ○ N off", member faces (up to 3, then +N) and the
  count. "Built in" is a quiet caption beside the name.
- Member count: it now comes from the same member list the Members row shows (both read
  `store_member`, all statuses, and reload together after every change). The 3 vs 4 seen earlier
  was a member removed between two reads, not a counting error.

Tests: `apps/admin/src/components/staff/role-access.test.ts`, `role-editor.test.tsx`.
