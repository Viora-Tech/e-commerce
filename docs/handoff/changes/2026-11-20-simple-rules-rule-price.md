# Delivery options: simpler product rule dialog, per-rule price, COD fee setting

Branch `feat/simple-rules-rule-price` (from `origin/dev`). Not pushed or merged. No migration:
rules and options are JSON (`delivery_route_rule.config`, `delivery_option.config`), and the
new fields have defaults.

## Engine (`packages/core/src/shipping/delivery-options/`)

- `config.ts`: `RouteRule.price = { mode: 'option' | 'free' | 'fixed', fixedPaise?, freeAbovePaise? }`,
  default `{ mode: 'option' }`, so saved rules price as before. `OptionCodSchema.fee =
  'included' | 'separate'`, default `included` (today's behaviour). `RULE_SPECIFICITY` moved
  here from `rules.ts` so the admin can read it.
- `rule-price.ts` (new): `cartRulePrices` (each product's winning rules' prices; a product
  with no rule counts as the option's own price; null when nothing changes the price),
  `withRulePrice` (the first courier's price: Free 0, Fixed amount, free above X from that
  order value; the highest charge wins in a mixed cart; shopper-ticked insurance is added on
  Free and Fixed, rule-required insurance is the store's), `codExtraPaise`, `withSeparateCodFee`.
- `pick.ts` (new, split from `resolve.ts`): `pickFor` applies the rule price to the winner
  (`finish`). Other couriers in a list cost that price plus the difference, using the existing
  `courierList` logic (`priceFromPick`). Rule alternatives use the same logic. A preferred
  courier that can't reach the PIN is skipped, and the next one keeps the rule's price.
- Which option takes the rule price: the list layout's option, else the **first enabled
  Standard option**. Express and other options keep their own price. This is the simplest
  reading of "not a fixed express price" and is documented in `config.ts`.
- COD:
  - `included`: the card's COD price is the price plus the courier's COD extra, as before.
    Under a rule price it is still added on a free rule (owner).
  - `separate`: the delivery price stays the prepaid one, and the extra is `codFeePaise`.
    `orderDeliveryFor` puts it in `shipping.codSurchargePaise`, so `paymentAdjustmentFor`
    charges it as the COD fee. Like a Shipping rate's own COD fee, it **takes the place of the
    store's COD fee** (Settings → Payments). `shownPrices` stores it under `…|cod|fee`, and
    the order never charges more than that.
  - Without a rule price, an option that is free (source `free`, or free-above reached) stays
    free on COD, in both modes. That is unchanged on purpose, so live stores don't move. Flip
    it in `withCod` (`courier-list.ts`) and `finish` (`pick.ts`) if the owner wants COD
    charged there too.
- Split carts: each parcel is priced on its own lines and the parcels are added up, so a Fixed
  ₹99 rule on two parcels charges twice. `codFeePaise` is summed in `parcels.ts`.
- `suggestions.ts` (new): `ruleSuggestions` turns shipping profiles into suggested rules.
  - A custom profile becomes a products rule at its lowest India rate (Fixed, or Free at ₹0)
    plus its free-above threshold.
  - General becomes an All-products rule at the normal price, free above its threshold.
  - A profile a rule already covers is skipped: same name, same products, or any All-products
    rule.
- `rule-checks.ts` (new): `collectionTwins` finds collections named like a ruled one ("Glass
  pads" / "Glasspads") whose products the rule misses.
- Storefront: `optionCodFee` (`delivery-cards.ts`) sets the rate's `codSurchargePaise`; a list
  card carries its own `codFeePaise` (`use-checkout-shipping.ts` `withChoice`).

API (`packages/api/src/routers/delivery-options.ts`): `ruleSuggestions` and `collectionTwins`,
both `settings.read`. The app manifest now declares `store-settings: read` ("Reads your
Shipping rates to suggest product rules"). `action-docs.generated.ts` was regenerated, which
also picked up a few procedures already stale on dev.

## Admin (`apps/admin/src/components/apps/delivery-options/`)

- `rule-dialog.tsx` has four numbered steps (`rule-step.tsx`):
  1. Products (`rule-products-field.tsx`, renamed from `rule-sentence.tsx`).
  2. Couriers: toggle chips of connected courier+speed (`rule-courier-chips.tsx`, from the
     route catalogue's `courierRows`). On a new rule every chip starts ticked.
  3. The courier included in the price, plus "Only this one, hide the others" (=
     `forceRoute`) (`rule-route-choices.tsx`).
  4. Price: Normal / Free / Fixed ₹, plus Free above ₹ (`rule-price-fields.tsx`).
- More now holds Through. "Shoppers will see" (`rule-preview-line.tsx`, `rule-sample.ts`) prices
  an example list from made-up costs, labelled as an example. The sentence states the price.
- Quick starts on a new rule: `rule-presets.ts`, `rule-presets-bar.tsx`.
- Rules that can't be shown as chips (a pinned service or two accounts) still open in the
  detailed editor, with step 4 numbered 2.
- Product rules page:
  - `rule-suggestions-card.tsx`: Add rule opens the dialog pre-filled through the `seed` prop;
    nothing is saved until Save.
  - `rule-order-card.tsx` / `rule-order.ts`: which rule should sit above which, "Sort by most
    specific" (saves through reorder), and warnings for one-courier rules (worse for All
    products) and twin collections.
  - Rule rows show a price chip.
- Option COD fee setting: `cod-fee-field.tsx`, on the option page and the courier-list card.
- Copy: `data/delivery-rule-form.ts` (new, with Hindi in `data/hi/delivery-rule-form.ts`,
  registered in `hi/index.ts`). `rulePreview` and `codFee` live in `delivery-options-pages.ts`.

## Tests

- Core: `rule-price.test.ts` covers free, fixed, free above, mixed carts, an unreachable
  preferred courier (plain and forced), Express keeping its price, and COD included vs
  separate through `orderDeliveryFor`. Also `suggestions.test.ts` and `rule-checks.test.ts`.
- Admin: `rule-draft.test.ts` covers old rules loading as `option`, chip round-trips, presets,
  suggestion seeds and the sample list. Also `rule-order.test.ts` and an updated
  `rule-preview.test.ts`.

## Left for the owner to check on localhost

- The dialog end to end against real connected couriers: chip labels come from the
  catalogue's carrier keys ("Delhivery Air", "Blue Dart Surface").
- Whether the separate COD fee should add to the store's Settings → Payments fee instead of
  replacing it.
