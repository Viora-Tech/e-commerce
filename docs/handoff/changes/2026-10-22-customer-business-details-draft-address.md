# Customer business details, draft address guard, Files list view, Pages under Online store

Owner-led UI testing on dev (22 Oct 2026).

## Drafts need a shipping address
- `convertDraft` refuses "Add a shipping address before converting" when a line needs shipping and the draft has
  no address (API 400). Gift-card-only drafts still convert; plan and app bills (`billing/service.ts`) opt out.
- Draft lines now record `gift_card` like checkout does (they never did, so gift-card drafts looked shippable).
- Admin: Convert explains why it is disabled. Storefront invoice pay page says the invoice has no delivery address.

## Supplier picker
- Purchase order supplier search results float over the form (closes on blur, Escape or pick).

## Customer business details (migration 0146)
- `customer.gstin`, `customer.business_name`. Checkout with a valid GSTIN saves them on the customer; a later
  checkout without them keeps what is saved. `customers.update` validates GSTIN like checkout; blank clears.
- Customer page: Business details card. Erasing a customer clears both; the data export includes them.
- Bulk editor: GSTIN, Business name, City, State, PIN code columns. Address cells edit the default address
  (`customers.updateAddress`) and are read-only without one. State list from `@commerce/core/states`.
- Not done: drafts have no buyer GSTIN fields, so picking a business customer does not prefill one.

## Navigation and Files
- Pages moved from Content to Online store in the sidebar (URL unchanged); Content hub lost "Go to pages".
- Files: grid / list toggle like the media picker (`?view=list`), list rows with the same ⋯ actions
  (`media/media-file-rows.tsx`).
