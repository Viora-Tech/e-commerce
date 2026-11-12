# Pickup date: no past days (12 Nov 2026)

- The pickup date pickers on a shipment's details ("Ask the courier to collect") and on
  Shipments › Pickups now start at today (`min={todayKey()}`), like the bulk pickup fields already did.
- `pickupReady` refuses a day before today, and the Pickups tab's button stays off for one.
- `shipments.schedulePickup` refuses a past or malformed date on the server (India day).
