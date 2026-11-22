# Courier tracking is polled hourly

**What:** the worker's `shipping-tracker` sweep now asks couriers about open shipments every hour
instead of every 30 minutes (`TRACK_EVERY_MS` in `apps/worker/src/shipping.ts`). Owner's call,
22 Nov 2026: scans change a few times a day, and fewer calls keep us clear of courier rate limits.
Courier webhooks still update a shipment the moment they arrive.

**Docs:** developer docs (orders, shipping) and the merchant guide (shipments) say "every hour".

**Live data, same day:** three shipments saved under the hand-typed name `Delhivery` (#1043 and
#1044 on Claw Gears, #2462 on Waimers) were moved to `delhivery` with the owner's OK, so the
tracker picks them up (see `2026-11-22-hand-typed-awb-tracking.md`).
