# Delivery options admin: Options, Routes and Product rules fixes (20 Nov 2026)

Branch `fix/delivery-options-admin`, refs #1781 and #1782. Admin only; the engine and checkout
side (new `config.ts` fields) lands on its own branch first.

- **Cherry-picked c18d97516** (`fix/delivery-try-pin-ui`): Try a PIN tables share column widths,
  an option that is off shows one line, the Try button sits above the results. The Fastest
  warning now says checkout tops the list back up to 3 cards (#1787's floor).
- **Options, mode picker:** the chosen mode is a tinted card with a filled radio and an "In use"
  chip.
- **Options, courier list:** no "Included in price" badge on courier rows. The preview card lets
  the admin change the sample PIN and weight and says "Cheapest for PIN 560038 · 2 kg: Blue Dart
  Surface (included)" (`courier-list-preview.tsx`).
- **Options, warnings and pointers:** Fastest plus "Hide slower and dearer" shows an inline
  warning (`inline-warning.tsx`) in the courier list, on fixed option cards and on the option
  page. A notice under the mode picker says Product rules set the default courier, with a link.
- **New settings (contract with the engine branch):** price source `free` ("Free (you pay the
  courier)") on the courier list, the option cards and the option page; "Show at most" has
  "All couriers" (`couriers.max: null`), the default for new options; "Offer parcel insurance at
  checkout" plus "Only for orders above" on the courier list and every fixed option card
  (`insurance-offer-fields.tsx`).
- **Routes:** the switch headings read "Show name at checkout" and "Use at checkout", each with
  an info tooltip (`column-help-head.tsx`).
- **Product rules dialog:** one sentence, "[Glasspads] ship only with [Delhivery] [+ Add
  courier]", with All products, Through (own account / RapidShyp / Shiprocket / either), Speeds,
  Preferred courier and `forceRoute`, and a collapsed More (always insure, apply only to some
  options). The form state and its mapping to the rule schema live in `rule-draft.ts`. A saved
  rule whose routes don't fit the sentence (mixed channels, a pinned service) opens in the old
  route-by-route editor. There is no live "what this rule gives" line yet: Try a PIN's `draft`
  takes the layout and options but not rules.
- **Product rules list:** the summary lists every allowed route, the preferred one first and
  marked "(preferred)" or "(always, at the option's price)".
- **Shell:** on wider screens the content panel leaves 1.5rem more room at the bottom when the
  bug-report button shows, so it no longer covers the last card's corner.
- Not changed: the sidebar store-address box overlapping "Customers" (#1781 item 6) could not
  be traced in code without a running admin.
