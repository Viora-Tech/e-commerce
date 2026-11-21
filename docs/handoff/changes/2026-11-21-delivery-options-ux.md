# Delivery options: full price for faster couriers, clearer settings (21 Nov 2026)

Owner feedback while testing "Round delivery prices": the settings need a lot better UI/UX, and
"Faster couriers cost" had no way to charge the faster courier's whole price.

## 1. Faster couriers: the courier's full price

- `OptionCouriersSchema.extra` takes `difference` (default, unchanged), `full` (new) or `none`
  (`COURIER_EXTRAS` in `config.ts`). Saved options keep `difference`.
- `priceFromPick` (`courier-list.ts`): with `full`, a dearer courier costs `fullPricePaise`
  (courier cost + insurance + the option's markup, rounded with the option's **Round delivery
  prices**), never less than the first card. A cheaper courier still costs what the first costs.
  Price limits (min/max) are not applied to the faster card: they bound the option's own price.
- `ResolvedOption.fullPrices` is set on such a list. The storefront (`delivery-cards.ts`,
  `courier-list.tsx` `rowPrice`) and the admin preview (`checkout-preview-list.tsx`) then show
  each row's own price ("₹89") instead of "+ ₹X". Prices go through the existing card prices, so
  `shownPrices` and `orderDeliveryFor` agree with no change (tested).

**Decision, product rules:** a rule's Free or Fixed price prices the first (included) courier,
as before. A faster courier under `full` costs its own full price, not the rule price plus the
difference, and never less than the first courier (a Fixed ₹199 rule above Blue Dart's own
₹129 shows Blue Dart at ₹199). Mixed carts: the first card takes the highest rule price as
before; faster couriers still cost their own price. A Free option price likewise covers only the
first courier. Free above an order value makes every route ₹0, so (as with `difference`) the
fastest courier goes first and every card is free.

## 2. Settings UI

- Options page, courier list (`price-includes-card.tsx`) and each fixed option card
  (`option-edit-card.tsx`): three sections, **What the shopper pays** (price, rounding, faster
  couriers cost, live example), **Which couriers show**, **Insurance and cash on delivery**
  (`option-section.tsx`). Fixed option cards that show every courier now offer "Faster couriers
  cost" too.
- Option page (`option-form.tsx` split into `option-pays-card.tsx`, `option-couriers-card.tsx`,
  `option-extras-card.tsx`, `rupee-field.tsx`, `number-field.tsx`): Name and status (Show at
  checkout moved up), What the shopper pays, Which couriers show, Insurance and cash on delivery,
  Delivery dates. The old "Round extras up to ₹…9" switch only shows where it still does
  something (₹10 rounding with the difference).
- Live example line (`option-example.ts`, `option-example-line.tsx`): "Delhivery Surface ₹49 ·
  Delhivery Air + ₹29" from made-up costs (Surface ₹43, Air ₹72), mirroring the engine.
- Copy: `data/delivery-option-sections.ts` (+ Hindi); old `courierList.fasterCost/fasterItems`
  removed; the price source no longer says "rounded up to the next ₹10". Merchant guide table
  updated. The product rule dialog and Try a PIN are unchanged.

## Checks run

- core `src/shipping/delivery-options` (199, new `full-price.test.ts`), admin
  `src/components/apps/delivery-options` + `lib/i18n.test.ts` (84, new `option-example.test.ts`),
  storefront delivery tests (42, new full-price row case).
- `tsc` for core, storefront, admin: only errors already on `dev` in this worktree (missing
  `@commerce/payments-snapmint`, `write-excel-file/node`, `customize-overrides.tsx`).
- `lint:components`: nothing in touched files. Biome clean on touched files except
  `resolve.ts` and `data/delivery-options.ts` (+ Hindi), whose format complaints are already on
  `dev`.
