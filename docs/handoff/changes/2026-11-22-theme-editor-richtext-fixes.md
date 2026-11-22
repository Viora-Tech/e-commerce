# Theme editor: rich text fixes (22 Nov 2026)

Found on the live admin (Waimers, imported "Zero Drift", product template, Product information).

## 1. "Offer panel steps" showed only its label

- Cause: `CUSTOMIZE_OVERRIDES.fieldLabel` returned an empty fragment. Puck draws a top-level
  `richtext` field's editor *inside* its label (`RichtextField` → `Label`), so the editor was
  thrown away with the label. Array and object sub-fields go through the public `AutoField`,
  which uses Puck's own label, so accordion bodies still had an editor.
- Fix: `fieldLabel` passes its children through (`apps/admin/src/lib/customize-overrides.tsx`).
  Our `FieldFrame` still draws the label.
- Other setting types: for imported Liquid sections (`packages/core/src/theme-import/fields.ts`)
  every value type maps to text/textarea/number/select/radio/object, so none is label-only;
  `header` and `paragraph` are label-only by design (skipped). The only Puck type that could
  still be label-only is a top-level `custom` field (our override replaces its `render`), and
  nothing defines one today.

## 2. React error #185 after editing an accordion body

- Cause: Puck's `useSyncedEditor` re-sends its last edit from an effect whenever `onChange`
  changes. `CustomizeArrayItem` (and `CustomizeObjectField`) handed `AutoField` a new arrow each
  render, so after one edit every render re-sent the old HTML, which changed the list, which
  re-rendered: an endless update loop (blur triggered the first re-render).
- Fix: `StableAutoField` (`components/themes/customize/stable-auto-field.tsx`) gives Puck one
  `onChange` for the field's life that calls the latest prop. Used for array card fields and
  object sub-fields. Test: `stable-auto-field.test.tsx`.

## "Before you pay" UPI text

Not in our code. The product page's UPI sheet (`ProductPaymentSignals`, `offer-modal`) draws the
Product information settings `offerHeading` (Offer panel heading) and `offerBody` (Offer panel
steps), imported from the theme block's `offer_heading` / `offer_body`; both are editable in
Customize now. Checkout's "2% off" chip comes from the payment method's discount setting. If the
sheet appears on the cart page itself, it is the imported theme's own Liquid (a `theme_file`),
which Customize cannot edit yet.
