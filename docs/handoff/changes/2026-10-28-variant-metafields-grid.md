# Variant metafields as a grid, saved with the product (#894)

Tester (#845, then #894): "still not able to add metafield separately variant wise". The card
on the product's Variants tab showed one variant at a time behind a dropdown and saved on its own
"Save extra fields" button; switching variants reloaded from the server, so anything typed and
not saved with that button was dropped without a word, and the page's Save changes never saved
these fields. Reproduced locally (Void Black: typed, switched, switched back: gone).

Now (`apps/admin/src/components/products/variant-metafields-card.tsx`), owner's choice:
- One row per saved variant, one column per variant field (Settings → Custom data →
  Variants); every variant is filled in without switching. The variant column stays put when the
  grid scrolls sideways.
- Saved with the product page's **Save changes**: `product-form.tsx` saves the product, then
  every variant whose fields changed (`saveRef`); a variant that fails is named in a toast, its
  cells show the errors and the save bar stays up. Edits count as unsaved changes (the save bar
  shows), and **Discard** puts the grid back.
- Variants added but not saved yet get their row after the save (a line says so).
- `FieldInput` takes `hideLabel` (the column header names the field; the label is read out as
  "Size label · Void Black").
- Copy: `metafieldsCardContent.variantHeading` / `variantHelp` / `variantNewLater` /
  `variantSaveFailed`, Hindi overlay.

Checked in the local admin: two variants, two fields, one Save changes → four values stored
(Void Black: Large, 4 mm; Royal Purple: Medium, 3 mm), save bar cleared.
