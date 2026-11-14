# Delhivery pickup: refusals are shown, not hidden (14 Nov 2026)

Waimers: "still not able to create a pickup request through Delhivery". The courier's refusal
is stored as a `failed` pickup row and returned, not thrown (`core/shipping/pickup.ts`). The
Create pickup drawer and the after-booking request already read it. Three other screens did not:

- **Shipments › Pickups and Apps › Delhivery › Pickups** (`pickups-tab.tsx`) showed a green
  "Schedule pickup" toast on a refusal. The list showed "failed" with no reason. Now it shows a red
  toast with the courier's words, and the reason sits under "failed" in the list. A failed row has
  no "Create manifest". The date starts filled (today, or tomorrow from noon), so the button
  is no longer grey until a date is picked. A start time that is not 24h keeps the button off.
- **Shipments › Booked › Create pickup** (`shipments-bulk-actions.tsx`) said "Pickup requested"
  on a refusal. Now it shows the refusal and keeps the dialog open. The date starts filled.
- **Bulk Create shipment › Pickups card** (`bulk-pickups-card.tsx`) said "Pickups created" on a
  refusal. Now it shows the refusal and keeps the button.
- Shared helper: `pickupRefusal` in `create-shipment/pickup-plan.ts`.

Delhivery adapter (`shipping-delhivery/src/label-pickup.ts`):
- `/fm/request/new/` answers refusals with 401 too. A 401 or 403 now counts as a bad token only
  when Delhivery's words are about the token (or it says nothing). Any other 401 is a refusal
  in Delhivery's own words, not "Delhivery rejected the credentials."
- Delhivery's words are read from `{ error: { message } }` and from field lists like
  `{"pickup_time": ["…"]}`, not pasted as raw JSON.
- `pr_exist` still counts as "already booked" whatever the status code (test added).

Server: `shipments.schedulePickup` takes only 24h times (`14:00` / `14:00:00`). Core logs
`courier pickup request refused` (store, provider, place, date, time, reason) on every refusal.
