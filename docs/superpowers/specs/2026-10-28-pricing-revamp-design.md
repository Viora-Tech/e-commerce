# Pricing revamp: plans, per-order fees, Scale, Own it, regional prices

Decided with the owner on 2026-10-28. This replaces the pricing of 2026-10-18 (`memory-bank/pricing.md`).

## Why

The old pricing never earned more as a store grew. It promised "0% transaction fee", and its one usage charge was ₹49 per extra 100 orders, about ₹0.49 an order. That charge was advertised but never billed.

Every competitor earns mostly from a cut of each sale:
- Shopify India: Basic ₹1,499/mo yearly plus a 2% fee.
- Instamojo: 2–5% + ₹3 per order.
- Dukaan: roughly 2–5%.

On ₹3 lakh a month of sales, a store paid Koomerce ₹1,548 and Shopify about ₹7,500.

The owner wants Koomerce profitable while staying clearly cheaper than all of them. Profitability here means covering the servers (Lightsail, ECR and Hetzner, about ₹3,000 a month) plus each store's own costs (AI, storage, email, the payment fee on our bill). Tools such as Claude Max are left out on purpose.

## Goals

- Every plan covers its own worst-case cost: a store that uses all its AI credits still leaves at least 60% of the plan price.
- Revenue grows with a store's orders, through a per-order fee that starts only after the plan's included orders.
- Every store size stays at about half of Shopify's equivalent or less.
- One plan has no per-order fee at all (Scale), plus a self-hosted license (Own it).
- Plans are priced by region: India in rupees, Tier 1 and Tier 2 in USD with local rounded prices.

## Non-goals

- Selling to stores outside India now. Regional prices are defined and stored, but stay hidden until Koomerce has a non-Indian payment gateway (Stripe or PayPal). Today it has only Razorpay, Cashfree and Decentro.
- Changing the AI credit top-up price (₹199 per 1,000) or how paid apps are sold.
- Blocking a store for any limit. Orders and visits are never blocked.

## Anti-goals

These would make this a failure even if it works:
- A tiny seller (about 40 orders a month) paying more than ₹499. The launch simulation showed ₹499 already feels heavy to them.
- A surprise bill. Every fee must be visible in the admin before it is billed, with a running estimate during the month.
- Charging a fee on an order the store didn't really get: cancelled or fully refunded.

## The plans (India, before 18% GST)

| Plan | Price/month | Yearly (2 months free) | Orders included/month | Fee per order after that | Fair-use visits/month | AI credits/month |
|---|---|---|---|---|---|---|
| Starter | ₹499 | ₹4,990 | 50 | 1% | 25,000 | 500 |
| Growth | ₹1,999 | ₹19,990 | 200 | 0.75% | 100,000 | 3,000 |
| Pro | ₹4,999 | ₹49,990 | 500 | 0.5% | 500,000 | 8,000 (was 15,000) |
| Scale | ₹14,999 | ₹1,49,990 | 2,000 | 0%, and no fee beyond 2,000 either | fair use | 15,000 *(builder's call: same as old Pro)* |

Staff, storage and features are unchanged from today for Starter, Growth and Pro.

Scale gets everything Pro has. *(Builder's call: staff 25, storage 100 GB, unlimited automations, priority support.)*

### Scale above 2,000 orders

There is still no fee. The 2,000 is the volume the price is sized for; past it, fair use applies (see "Visits" below). The owner's intent is that a big store's bill stops growing. Scale starts paying off against Pro at about 2,500 orders: ₹4,999 + 2,000 × ₹5 = ₹14,999.

### Own it (self-hosted license)

- ₹49,999 one-time license, ₹3,000/month care (12-month minimum), ₹7,500 optional setup on the brand's server.
- 0% fee, unlimited orders. The brand pays for its own server.
- Terms are unchanged from `memory-bank/pricing.md`: one brand per license, not resold, no competing SaaS.
- Sold by talking to us (a "Talk to us" button), not self-serve.

### Trial and billing basics (unchanged)

- 14 days of Growth for every new store, no card needed.
- Yearly billing gets 2 months free.
- Prices are before 18% GST; GST is added on the bill, with a GST invoice.
- A downgrade waits for the period to end. An upgrade is billed now.

## The per-order fee

### Which orders it covers

Counted per calendar month in IST, over the days the store was on a paid plan (see "Trial and unpaid stores"), the same way the sidebar's "Orders this month" counts today (`packages/core/src/billing/usage.ts`): placed orders, not drafts, not cancelled, not test-mode. Orders are taken in the order they were placed. The first N (the plan's included orders) carry no fee; every order after them carries the plan's fee rate.

### What the fee is charged on

The order's total as the buyer paid it: items after discounts, plus shipping, plus tax.

- Orders cancelled, or refunded in full, before the month's fee bill is made are left out.
- A part refund still counts the whole order. This matches Shopify.

### Which plan's rate

The store's plan at the moment the order was placed. A store that upgrades mid-month pays the new rate, and gets the new included count, from that moment on.

*(Builder's call: if handling this mid-month is hard, use the plan in force at month end and say so in the admin.)*

### COD orders

COD orders count like any other. The fee is a platform fee, not a payment fee. Orders returned to origin (RTO) end up cancelled, so they drop out.

### When it is billed

Once a month. On the 1st (IST), the billing sweep makes a **usage bill** for the month that just ended: one order on the platform sales store, with one line per plan rate that applied. It is separate from the plan renewal bill.

- No usage bill is made if the fee total is ₹0.
- If a store's fees for a month come to under ₹100, they carry forward to the next month instead of being billed. *(Builder's call.)*
- An unpaid usage bill never pauses the store by itself (owner's decision). The admin shows a banner and the owner gets email reminders. If it is still unpaid when the next plan bill is made, its amount is added to that plan bill as a line, and from then on the plan bill's normal due, overdue and paused rules (`GRACE_DAYS`) apply. `storePlan.status` keeps one source: the plan period.
- Usage bills always go out as a pay link plus an email, including for stores on UPI AutoPay. AutoPay is a fixed-amount Razorpay subscription and cannot collect a changing amount. The admin says this next to the AutoPay switch. Charging usage on the mandate is left for later. *(My call.)*

### Trial and unpaid stores

- Orders placed during the 14-day trial carry no fee and don't use up included orders (owner's decision). Counting starts on the first paid day.
- A store whose trial ended without paying, or whose plan is paused, carries no fee for those days: it has no paid plan rate.
- In a month where a store's first paid day is mid-month, the included orders still apply in full from that day.

### In the admin

- The billing page shows, for this month: orders so far, the included count, the fee orders so far, and the **estimated fee so far**.
- The sidebar usage card warns at 80% and 100% of the included orders, and says what each further order costs.
- Past usage bills are listed with the orders they covered, downloadable as CSV.

### The old ₹49 per 100

This is removed everywhere: code comments, the site, docs and `memory-bank/pricing.md`.

## Visits (fair use)

- Visits are the existing analytics **sessions** (a visit ends after 30 minutes idle), counted per calendar month. Known bots are excluded (Cloudflare bot signals, or the user agent).
- A store is over fair use if it is over its plan's visits for **two months running**.
- When that happens, the admin shows a notice, the owner gets an email, and Koomerce reaches out. Nothing is blocked, slowed or billed automatically.
- The limits are stated in the Terms and on the pricing page as "fair use".
- Fair use on Scale and above is judged by hand.

## Regional prices (stored now, sold later)

| Plan | India | Tier 1 (USD) | Tier 2 (USD) |
|---|---|---|---|
| Starter | ₹499 | $19 | $12 |
| Growth | ₹1,999 | $49 | $29 |
| Pro | ₹4,999 | $129 | $79 |
| Scale | ₹14,999 | $349 | $199 |
| Own it | ₹49,999 + ₹3,000/mo | $1,999 + $99/mo | $1,299 + $69/mo |

- **Tier 1:** US, UK, the EU, Japan, Australia, Canada, Singapore, UAE.
- **Tier 2:** Southeast Asia (other than Singapore), Latin America, and the rest of the world.
- **Fixed local prices for Tier 1:**
  - GBP £15 / £39 / £99 / £279
  - EUR €17 / €45 / €119 / €319
  - JPY ¥2,900 / ¥7,500 / ¥19,800 / ¥52,000
- Yearly is 10× the monthly price in every currency.
- Fee rates and included orders are the same in every region.
- The region comes from the store's country. The table lives next to `PLANS`. Neither the admin nor the site shows non-India prices until a non-Indian gateway can bill them. The switch is a single flag.

## Profit check (worst case per store, India)

| | Starter | Growth | Pro | Scale |
|---|---|---|---|---|
| Price | ₹499 | ₹1,999 | ₹4,999 | ₹14,999 |
| AI fully used | ₹50 | ₹300 | ₹800 | ₹1,500 |
| Server share (estimate: one ₹2,000 server per ~50 stores; Scale gets more) | ₹40 | ₹80 | ₹150 | ₹600 |
| Payment fee on our bill (~2%) | ₹10 | ₹40 | ₹100 | ₹300 |
| Storage + email | ₹15 | ₹35 | ₹110 | ₹250 |
| **Kept** | **₹384 (77%)** | **₹1,544 (77%)** | **₹3,839 (77%)** | **₹12,349 (82%)** |

Servers cost about ₹3,000 a month, so Koomerce covers them from about 5 paying stores, before any per-order fees.

The server-share line is an estimate. It should be measured once real stores are live (CPU and memory per store on the Lightsail box).

## What changes, and where

### Billing core: `packages/core/src/billing/`

- `plans.ts`:
  - Add `scale`.
  - New prices, orders and AI tiers.
  - Add `feeBasisPoints` per plan (100 / 75 / 50 / 0) and `visitsPerMonth` (null on Scale).
  - Add the regional price table.
- A new usage-fee module: fee orders for a store and month, the fee total, and the running estimate.
- `runBillingSweep`: make the monthly usage bill.
- Sales orders: today `placeSalesOrder` places one SKU line. The usage bill needs a line whose amount is computed, not a fixed variant price. *(Builder decides how: a custom-price line, or a "usage fee" variant at ₹0.01 × quantity, or similar.)*
- `packages/ai/src/plans.ts`: Pro 8,000 credits; add a Scale tier.
- `packages/config/src/site.ts`: mirror the plans (this is what the site reads).

### Database

- Table for usage bills: store, month, orders counted, fee orders, fee total, sales order, status.
- A `scale` value wherever the plan enum lives.
- Migrations follow the repo rules: RLS, `apply_store_rls()`.

### Admin

- Plan & billing: new plan cards (with Scale and a "Talk to us" Own it card), this month's fee estimate, and the usage bills list.
- The sidebar usage card's new warnings.
- Hindi copy in `data/hi/`.

### Site: `apps/www`

- Pricing page:
  - Four plan cards plus an Own it band.
  - Compare table with fee rate, orders and visits.
  - The calculator works out plan plus fees.
  - FAQ rewritten. "0% transaction fee" becomes "0% on Scale; on other plans, a small fee only after your included orders".
- Home and solutions pages: change every "0% transaction fee" claim.

### Docs, legal and memory

- Docs: the merchant guide's billing page, and developer docs where plans are described.
- Terms: fair use, how the per-order fee is counted and billed.
- `memory-bank/pricing.md` is rewritten to this design.

## Existing stores

There are no paying stores yet (Waimers is the owner's, claw-gears is a test). New prices apply to everyone from release. Any store on a paid period keeps its current price until that period ends. *(Builder's call.)*

## Left to the builder

- How the computed-amount sales line is made.
- Scale's staff and storage numbers (proposed above).
- The carry-forward threshold.
- How bot visits are recognised.
- Exact admin layouts, following `docs/design/admin-frames.md`.
