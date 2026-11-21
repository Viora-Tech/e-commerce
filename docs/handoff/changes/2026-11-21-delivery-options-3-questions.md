# Delivery options: the 3-question settings (21 Nov 2026)

The owner tested Apps → Delivery options → Options (Courier list (automatic)) after the sections
pass this morning and said it was "still so confusing". They chose a 3-question layout. Only the
layout and where each setting sits changed. Saving, dirty state and the Save button work as before.

## What the merchant sees

Options page, courier list: a **Delivery price** card first, then **Couriers shoppers may see**
(unchanged). The **Checkout preview** stays on the right on wide screens and goes below on phones.

1. **Who pays for delivery?** Tick cards: Shopper pays the courier cost (+ your markup) / Your
   Shipping rates / Free delivery, you pay the courier.
2. **Can shoppers pick a faster courier?** No, show one courier only / Yes, they pay the extra
   (+ ₹29) / Yes, they pay its full price (₹80). The amounts come from `option-example.ts` (made-up
   Surface ₹43, Air ₹72) with the option's markup and rounding, so they follow the settings. When
   the included courier is already the fastest, the cards name no amount.
3. **Round prices to**: a segmented ₹…9 / ₹…49/…99 / ₹10 / Off, with what the chosen one does
   ("₹43 → ₹49") and the "At checkout, for example" line under it.

Then **▸ More settings** (Markup, limits, insurance, COD fee): price (markup ₹ and %, free above,
never less / never more than), the included courier (cheapest or fastest), show at most, hide
slower and dearer, **Faster couriers at the first courier's price** (the old "Your price, nothing
extra"), parcel insurance (+ only above) and the COD fee. It is closed by default and opens by
itself when anything in it differs from a new option's default. The closed header shows
"N changed". With "No, show one courier only", the list-only settings (show at most, hide, same
price) are hidden.

An option's own page: **Name and status** (name, line under it, **speed** moved here, Show at
checkout), then **Delivery price** with the same questions (question 2 only when "Let shoppers pick
the courier" is on, so a single-card option gets Q1 and Q3), then one **More settings** with Price,
Which couriers show, Insurance and cash on delivery, and Delivery dates.

Fixed options cards (my call): each card now shows **one summary line** ("Courier cost + markup ·
One courier · Rounded to ₹…9"), the example line and an **Edit** button to the option's page,
instead of six selects in three sections per card. With two or more options the page was a wall
of fields, and the answers now live in one place, the option's page, in the same 3-question form.
The grip, name link, Picked by default chip and the on/off switch stay, and they still save with
the page's Save.

## How the answers map to settings

| Answer | Setting |
| --- | --- |
| Q1 | `price.source`: `route` / `zone` / `free` |
| Q2 No | `couriers.max: 1` |
| Q2 Yes, the extra | `couriers.extra: 'difference'` (and `max` 1 back to `null`, every courier) |
| Q2 Yes, full price | `couriers.extra: 'full'` (same) |
| More: same price | `couriers.extra: 'none'`; Q2 then ticks no card and says so under it |
| Q3 | `price.rounding`. On a list, `couriers.roundTo9` follows it (off when Off), as before |

**The one schema change:** `OptionCouriersSchema.max` took 2 to 20, and now it takes 1 to 20. The
list layout always shows every courier (`resolve.ts` forces `show: 'list'`), so `show` could not
mean "one courier", and nothing else limited the list to one. `courierList` already handles
`max: 1` (the floor is `min(3, max, n)`), so the engine is unchanged: one card, the included
courier at its own price. The storefront already shows a one-courier list, which happens when
only one courier delivers. Saved options are unaffected. The new test is `one-courier.test.ts`
(fixed and list layouts, and the order charges what the card showed). `optionExample` shows one
card when `max` is 1. The option page's form now keeps `1` (`inputOf` clamped to 2).

Mapping and counts: `option-answers.ts` (`fasterOf`/`withFaster`, the form twins,
`withRounding`, `fasterAmounts`, `listMoreChanged`, `formMoreChanged`). Express being prepaid
only, the question answers and speed do not count as "changed".

## Files

- New: `delivery-questions.tsx`, `tick-cards.tsx` (radio cards like `layout-picker.tsx`: native
  radios, so arrow keys work, and the whole card is the label), `rounding-segments.tsx` (the admin's
  `ToggleGroup variant="segmented"`), `more-settings.tsx` (Collapsible, like the rule dialog's
  More), `list-questions-card.tsx` (was `price-includes-card.tsx`), `list-more-fields.tsx`,
  `list-price-fields.tsx`, `option-dates-fields.tsx`, `option-answers.ts` + test,
  `data/delivery-option-questions.ts` + Hindi.
- Renamed to sections inside More settings: `option-couriers-card` → `option-couriers-fields`,
  `option-extras-card` → `option-extras-fields`, `option-pays-card` → `option-price-fields`.
- Removed (unused now): `faster-cost-field.tsx`, `rounding-field.tsx`.
- `rule-step.tsx`: an optional heading `id`, and it is a `fieldset` now (biome's semantic role
  rule).
- `option-edit-card.tsx` summary, `options-page.tsx` order, `option-form.tsx`, `option-example.ts`.
- Merchant guide: the option table is now the 3 questions and More settings.
- Left alone: some copy keys are no longer read (`optionCards.picks/pays/payment/shows` with
  their items, `courierList.round/roundHelp/roundHelpFixed/includedHelp/pays/paysItems/priceTitle`,
  `deliveryOptionSectionsContent.faster` and `sections.pays`). They can go in a tidy-up.

## Checks run

- admin `src/components/apps/delivery-options` + `src/lib/i18n.test.ts`: 9 files, 68 tests pass
  (new `option-answers.test.ts`, 10).
- core `src/shipping/delivery-options`: 17 files, 203 tests pass (new `one-courier.test.ts`).
- `bunx tsc --noEmit -p apps/admin`: only the errors already on `dev` in this worktree
  (`customize-overrides.tsx`, `@commerce/payments-snapmint`, `write-excel-file/node`).
- `bun run lint:components`: nothing in touched files. Biome is clean on touched files.
