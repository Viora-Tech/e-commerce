# Push notifications: turn off on this device, and a removable devices list

Branch `feat/push-turn-off` (from `origin/dev`). Owner feedback 27 Nov: push works "but no way to
turn them off". No migration.

## What changed

- Account → Notifications (the bell's "Notification settings" link goes there), card "Push on
  this device":
  - says "Push notifications are on for this device" (or off) next to the On/Off chip;
  - **Turn off** (already there) now always unsubscribes the browser
    (`PushSubscription.unsubscribe`) even when the server call fails, leaves the state Off and
    shows "Push turned off for this device" or its own error (it used to show the "could not be
    turned on" text);
  - new "Devices with push on" list below: every device the member has push on for in this store
    (browser and system from the saved user agent, "Added <date>", "Last push <when>"), this
    browser marked "This device", each other one with **Remove** (asks first). This is the way to
    stop pushes on a phone you no longer have, or on a browser whose site data was cleared (its
    row stays on the server, and this browser then sees push as Off with no Turn off).
- Per-type choices were already there: the Push column in "What you hear about" (New order,
  Inbox message, Approval waiting, Out of stock, Payment problem, App error). Nothing changed.
- Never pushed again: Turn off and Remove delete the `member_push_subscription` row; the worker
  (`packages/core/src/push/deliver.ts`) reads rows at send time, so a removed device is never sent
  to, and a device the push service says is gone (404/410) is still dropped.
- Code:
  - `packages/core/src/push/subscriptions.ts`: `listPushDevices` (no endpoint or keys out, only a
    `thisDevice` flag from the caller's endpoint) and `removePushDeviceById` (own rows only).
  - `packages/api/src/routers/account-push.ts` (new, spread into `accountRouter`): the push
    procedures moved out of `account.ts` (`savePushDevice`, `removePushDevice`) plus new
    `pushDevices` and `removePushDeviceById` (NOT_FOUND for another member's or store's id).
    `pushPublicKey` lives here now. Sweep allow-list in `scripts/sweeps/router-permissions.test.ts`
    and `packages/api/src/mcp/action-docs.generated.ts` updated.
  - Admin: `apps/admin/src/hooks/use-push-device.ts` (returns `endpoint`, safer `turnOff`),
    `components/account/push-device-card.tsx`, new `components/account/push-device-list.tsx`;
    copy in `data/account.ts` (`notifications.push.onLine`, `offLine`, `turnedOff`,
    `turnOffFailed`, `list.*`) with Hindi in `data/hi/account.ts`.

## Tests

- New `packages/api/test/account-push.test.ts`: the list shows only the caller's devices, marks
  this one and leaks no endpoint or keys; Turn off removes only this browser's row; another
  member's endpoint removes nothing; Remove deletes the caller's own device; Remove refuses
  another member's device and another store's device and leaves them in place.

## Left to do / for the owner to check

- On localhost, Account → Notifications: turn push on, see the line and the device in the list
  as "This device", Turn off, see it go. Turn it on in a second browser and Remove it from the
  first; a test push should then reach only the remaining one.
