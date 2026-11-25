# Create shipment: a courier is booked only by Ship now in the list

**What:** `create-shipment-page.tsx`: Book shipment always opens the courier list (Ship it
yourself aside); a courier is booked only by its own Ship now there. Picking a row and closing
the list with × is not a choice any more. The "chosen by hand" state is gone (it also replaces
the 23 Nov `handlePackage` reset, `2026-11-23-book-shipment-reopens-after-package-change.md`).

**Why:** Owner, 24 Nov testing on localhost: picked Delhivery Express in the list, closed it with
×, pressed Book shipment, and it booked Delhivery Express without showing the list.

**Tests:** admin typecheck; Biome clean. Owner to re-test on localhost.
