# Profit you can trust: packaging, delivery estimates, monthly expenses, floor profit

Status: design, awaiting owner approval (22 Oct 2026).

## Why

A seller decides prices, discounts and ad spend on margin. Today Koomerce shows each order's profit
(`packages/core/src/order/profit.ts`, `PROFIT_FORMULA`), but three real costs are missing or zero until
much later, so the number reads better than reality:

- **Packing** is not counted at all.
- **Delivery** is zero until the courier's charge is known (`shipment.courier_cost_paise`), so a fresh
  order looks more profitable than it will be.
- **Running costs** (website, server, staff, apps) are nowhere, so a seller cannot see whether the
  month as a whole made money.

The owner's framing: one order's profit is an estimate (two identical armsleeve orders may show ₹50
each when reality was ₹60 and ₹40). What a seller should trust is the **average over time**, and we
should show a **floor**: "you made at least this much, based on what you entered". Real profit is
usually a little higher.

## Goals

1. Count packing, once per parcel, from packaging the seller defines in Settings.
2. Count delivery on every order from day one: an estimate until the courier's real charge arrives.
3. Let the seller enter monthly running costs and see net profit per month.
4. Show averages: profit per order, per product unit, and by basket size (1 / 2 / 3+ items).
5. Make every uncertain figure cautious (a floor) and say so in one plain line.

## Non-goals

- Ad spend or marketing cost per order (possible later as a monthly expense or per-order setting).
- Automatic box choice by product dimensions. v1 suggests from the products' packaging; the packer
  can change it.
- Changing how net sales, goods cost, fees or RTO are computed today.

## Anti-goals (a failure even if it works)

- A profit figure that is higher than reality because something unknown counted as ₹0.
- Changing a past order's profit when the seller edits a packaging cost or a monthly expense for a
  later month.
- More fields on the product form than a seller will fill in.

## Decided with the owner

- **Packaging lives in Settings, not on each product.** The seller defines packing types with a cost once
  (e.g. Poly mailer ₹8, Glasspad tube ₹30, Box S ₹25); a product picks one; it has no packing-cost field
  of its own. (Built on the existing box presets, see Design §1.)
- **Packing and delivery are per shipment, not per item.** Three armsleeves in one parcel pay one ₹100
  delivery and one mailer, so bigger baskets earn more; the profit view must make that visible.
- **Delivery is part of order profit**, estimated until known.
- **Monthly expenses** (website, server, staff, apps, rent…) are entered by the seller and taken off the
  month's order profit to give net profit.
- **Floor, not hopeful**: wherever a cost is unknown, use the cautious value, flag the order as
  estimated, and show the sentence "Based on the costs you entered. Your real profit may be higher or
  lower if some costs differ."

## Design

### 1. Packaging = the existing box presets, with a cost

The store already has named boxes in Settings → Shipping (`boxPresets`, `packages/core/src/shipping/settings.ts`,
one default), products already pick one (`variant.box_preset_id` on the Shipping card), and booking already
resolves a parcel's box (`resolveParcelPackage`, `shipping/parcel.ts`). Packaging reuses them; there is no
second list or second dropdown (anti-goal 3).

- Each box preset gains `costPaise` (what one box plus its filler costs) and a stable id / archived flag if
  missing. Settings → Shipping shows the cost beside each box; the owner's "Poly mailer ₹8, Glasspad tube ₹30"
  are box presets.
- **Shipment snapshot**: `shipment.packing_cost_paise` (and the preset id) written when the parcel is booked or
  marked packed, so later price edits never change past profit.
- The parcel's box is whatever `resolveParcelPackage` already picks (the packer can change it in the existing
  flow); its cost is the packing cost.
- A preset with no cost counts as ₹0 and flags "packing cost not set" on the order and in the report.

### 2. Delivery estimate

- `shipment.courier_charge_paise` (typed, or returned by the courier at booking) is the **real** charge. There is
  no later billing reconciliation, so a booking charge is final.
- A parcel without a charge yet uses an **estimate**, flagged:
  1. the **highest** real charge this store paid in the last 60 days for the same courier and destination
     state; else
  2. "Default delivery cost per parcel" in Settings → Costs for profit (default ₹100).
- COD fee keeps its current rule.

### Which parcels get estimates

- Estimates are **per parcel** (`fulfillment_order`), not per order: a two-location order is two parcels.
  A partly shipped order counts real costs for shipped parcels and estimates for the rest.
- No packing or delivery estimate for: orders cancelled before any parcel was packed or booked, orders with
  no shippable line (gift cards, digital), local pickup / self-delivery parcels.
- A shipment cancelled after packing keeps its packing cost; delivery counts only if the courier charged.

### GST on packing and delivery

- GST-registered stores (regular registration): box costs, the default delivery cost and courier charges are
  typed **before GST** (the GST comes back as input credit). Settings labels say so.
- Other stores: they type **what they actually pay**, GST included; nothing is added. The same rule applies to
  the estimate and the real charge, so profit does not jump when the real charge arrives.
- Payment fees keep their current rule.

### 3. Monthly expenses (Settings → Monthly expenses)

- New table `monthly_expense`: `id`, `name`, `amount_paise`, `starts_on` (month), `ends_on` (nullable
  month), `archived_at`. Amounts before GST when the store is GST-registered (input credit), as typed
  otherwise.
- An expense counts in every month from `starts_on` to `ends_on`. Editing an amount creates a new
  version from a chosen month, so past months keep the amount they had (anti-goal 2).

### 4. Profit formula (extends PROFIT_FORMULA)

```
net sales − goods − packing − courier (actual or estimate) − fees − RTO = order profit
Σ order profit in the month − monthly expenses = net profit
```

- `packing` = Σ parcel packing: the shipment snapshot when packed/booked, else the parcel's box cost now.
- New flags on `OrderProfit`: `packingEstimated`, `courierEstimated` (replaces treating a missing
  courier as ₹0; `courierMissing` stays for data that cannot be estimated).
- `allocateProfit` splits packing like courier (by line value), so per-product profit includes its
  share.

### 5. Where the seller sees it

- **Order page, Profit card**: adds Packing; Courier shows "estimated" until real; a short "Estimated"
  tag on the card when any part is estimated.
- **Analytics → Profit** (`reports/profit.ts`):
  - Profit by month adds Packing, Monthly expenses and **Net profit**, plus a one-line verdict
    ("Profitable this month" / "₹X short: about N more orders at your average profit").
  - New **average profit** tiles: per order, per unit by product, and **by basket size** (1 / 2 / 3+
    items) so the multi-item gain is visible.
  - Each figure shows how much of it is estimated (e.g. "12 of 140 orders still estimated").
- The floor sentence appears once on the Profit report and on the Profit card.

## Left to the builder

- Exact UI placement within existing cards and Settings sections, following `docs/design/admin-frames.md`.
- Migration numbering (next free number after the highest file in `packages/db/drizzle`).
- How the packer changes packaging in the existing pack/book flows (smallest sensible touch).
- Whether the "rate quote at booking" is already stored; if not, skip that estimate step.
- Report column naming and Hindi copy.

## Calls I made (owner to check)

- Packaging reuses the existing box presets (one list, one dropdown) instead of a new Packaging list.
- A courier's charge returned at booking counts as real; only parcels with no charge are estimated.
- Cautious delivery estimate = highest real charge in 60 days for that courier and state, else ₹100 default.
- Estimates are per parcel; cancelled-before-packing, gift-card-only and pickup orders get none.
- GST: registered stores type costs before GST; other stores type what they pay.
- Monthly expense edits apply from a chosen month forward; past months never change.

## Open for the owner

- Past orders at launch (see answer when given).
- Expenses in a month still in progress (see answer when given).
