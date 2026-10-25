# Gift card codes, inventory alignment, segment templates, bulk "Change for all"

Owner-led UI testing on dev (22 Oct 2026).

## Gift cards
- Generated codes are 12 characters (60 bits, unambiguous alphabet, shown `ABCD EFGH JKLM`); existing
  16-character codes keep working. `generateGiftCardCode` moved to `gift-cards/client.ts` (Web Crypto) so the
  create form's new **Generate** button and the server share it.
- Customer picker (`gift-cards/customer-picker.tsx`): focusing lists recent customers, search from the first
  letter, "Searching…" / "No customers match" / "Could not load customers", Enter picks, Esc closes. Browser
  email autofill is off on it and on the draft order customer search.

## Tables and dropdowns
- Resource tables: the hidden sort arrow no longer pushes right-aligned headers off their numbers (it sits
  before the title; centred columns float it outside).
- Inventory: Available / Committed / Incoming / On hand are centred; the Available stepper is − number + with
  the buttons sliding in on hover; long SKUs truncate with a tooltip.
- Shared `SelectContent` defaults to `alignItemWithTrigger = false`: every dropdown opens below its field
  instead of over it.

## Segments
- "Start from a template" card (`customers/segment-templates.tsx`): seven starter segments that open the
  builder prefilled (`/customers/segments/new?name=&rules=`). Hidden once saved under the same name.
- Fix: the segments list showed spend rules 100× too high (the rule value is already paise).

## Customer bulk editor
- **Change for all** dialog (`bulk-edit/customers-bulk-set-all*.ts(x)`): tags add / remove / replace, note
  append / replace / clear, marketing subscribe / unsubscribe per channel. Applies to the sheet only; Save
  sends it. Erased customers are skipped, and email marketing skips customers without an email.
