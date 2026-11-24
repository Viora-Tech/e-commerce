# Create shipment: Book shipment opens the courier list again after a package change

**What:** `create-shipment-page.tsx` `handlePackage`: any change to the package (weight, size,
box, contents, the parcel, the pickup place) clears "courier picked by hand", so Book shipment
opens the courier list with the new prices instead of booking the courier picked earlier.

**Why:** Owner, 23 Nov: picked Delhivery Surface in the drawer, closed it with ×, changed the
weight/description, pressed Book shipment, and it booked Delhivery Surface straight away at the
old choice without showing the list.

**Tests:** admin typecheck; Biome clean.
