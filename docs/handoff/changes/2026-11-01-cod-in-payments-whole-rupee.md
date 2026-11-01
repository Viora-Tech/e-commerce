# COD rules in Payments, whole-rupee discounts and deposits, one date picker

- #97 (owner: "Payments only"): the cash on delivery fee, largest order, blocked PIN codes and
  WhatsApp check are edited in Settings › Payments › Manual (`CodSettingsSection`, under the
  manual methods card; the COD "Settings" button scrolls to it). Storage is unchanged
  (`checkout.cod` and the `cod` payment adjustment), so the checkout behaves the same.
  Settings › Checkout's COD row now only links to Payments.
- #141/#156 (owner: round to whole ₹): `roundToWholeUnit()` in `@commerce/money`. Percent
  discounts (order, per item, buy X get Y) and percentage pre-order deposits round to the
  currency's whole unit; the balance is the exact rest.
- #126: every admin date and datetime input uses `DateField` (platform filters left native:
  it is a plain GET form).
- #101: `focusFirstIssue` also finds `<form>-<field>` ids and marks the field `aria-invalid`
  until it is edited.
