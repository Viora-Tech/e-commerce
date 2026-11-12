# Pickup: no days that have passed (#1613)

- The pickup date picker (`pickup-fields.tsx`) starts at today (`min={todayKey()}`).
- `schedulePickup` (`core/shipping/pickup.ts`) refuses a new pickup on a past day (India time)
  with "Pick today or a later day for the pickup"; joining an already scheduled pickup is unchanged.
- Test in `shipments.test.ts`; the existing pickup tests moved to future dates.
