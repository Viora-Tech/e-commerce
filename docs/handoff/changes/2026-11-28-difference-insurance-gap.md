# Difference mode: shipping and insurance gaps priced apart

Branch `fix/difference-insurance-gap`. With insurance on, Amazon and Ekart (both via RapidShyp,
same insurance rate 0.89% + GST) showed different extras in a `couriers.extra: "difference"`
list: +₹49 and +₹59 against Delhivery Express (Protect 0.40% + GST). Their cheaper shipping was
netted against the insurance gap. Waimers, one mouse ₹10,999, PIN 131001, Delhivery Express
free (owner, 28 Nov 2026).

- `differenceExtraPaise` in `packages/core/src/shipping/delivery-options/courier-list.ts`: a
  `difference` card adds `round(max(0, shipping − pick's shipping)) + round(max(0, insurance −
  pick's insurance))`, each rounded the option's extra rounding (`extraRounding`), like
  `ownPricePaise` rounds insurance on its own. `priceFromPick` uses it; `full`, `own` and
  `none` are unchanged. A card still never shows below the pick.
- Effect (test fixture shipping: Delhivery ₹120, Amazon ₹100, Ekart ₹115, Blue Dart Air ₹180;
  one mouse ₹10,999, rounding to …9):

  | Card | Before, insurance on | After, insurance on | Insurance off (both) |
  | --- | --- | --- | --- |
  | Amazon | +₹49 | +₹69 | ₹0 |
  | Ekart | +₹59 | +₹69 | ₹0 |
  | Blue Dart Air | +₹129 | +₹138 | +₹69 |

  A courier dearer on both shipping and insurance can now show up to one rounding step more,
  since each gap is rounded on its own.
- Tests: new `difference-insurance.test.ts`; the `difference` case in `own-price.test.ts` now
  expects Amazon and Ekart both +₹129 (two mice; was +₹109 and +₹129).
- Check on localhost: Try a PIN 131001 with a mouse on an option set to "Add the difference",
  insurance on and off.
