# Plan & billing redesign, prorated plan changes (Figma 931:9997, 931:10521, 931:11086)

Branch `feat/billing-redesign`.

## Pages

- **Plan & billing** (`components/billing/billing-page.tsx`): one open page instead of drill rows.
  Header with View all plans (Change plan's compare table) and Change plan; banners as before;
  the plan card (status chip, interval and renewal, included orders and fee, price + GST, usage
  bars, and the "close to 200 orders… Pro would save about ₹1,100 · See Pro" nudge only when the
  maths says so) beside a new **Next bill** card (`next-bill-card.tsx`: plan at renewal, per-order
  fees so far, renewing paid apps, GST 18%, due date, UPI AutoPay line and button); then Apps and
  your plan (chips: Included in X / Bought · ₹/month / ₹/month + Buy, Stop renewing), Invoices
  (rows with Download/Pay; "Invoices are emailed to …"), and per-order fee bills when there are any.
  The separate Payment method and Downgrade drill rows are gone: AutoPay lives in Next bill,
  downgrades go through Change plan.
- **Change plan** (`plan-chooser.tsx`, `plan-compare-table.tsx`): cards with Current/Suggested
  chips, price, an "N orders, then x%" box with "≈ ₹ fees at your pace" (current and smaller
  plans), "Best value past ~N orders" (bigger plans) or "No per-order fee at all", three
  highlights, Move to X; "Based on N orders this month" beside the toggle; Compare everything
  table (Figma rows plus storage, visits and apps, which left the cards); Own it with Talk to us.
  Suggested is the plan the nudge picks (cheaper at this pace), not "next plan at 80%".
  The trial popup (`compare-plans-dialog.tsx`) uses the same chooser and the same confirm.
- **Move to X?** (`plan-move-dialog.tsx`): the server quote as a breakdown (new plan for its
  dates, old plan's days not used, GST 18%, unpaid fees if any, Pay now, From <date> at
  ₹/month + GST), You get, and "Pay ₹X and move". A downgrade shows when it starts; nothing charged.

## Back end

- `billing/proration.ts` `quotePlanChange` (pure): the one rule for a plan change, see developer
  docs "Changing plans (proration)". `billing/plan-change.ts`: `loadPlanChangeQuote`,
  `choosePlan` (now bills the quote), `AlreadyOnPlan`. `billing.quote` oRPC procedure
  (SETTINGS_READ); `billing.choose` maps `AlreadyOnPlan` to CONFLICT.
- `createPlanBill` takes the quote: its period, and for prorated/credited bills the plan line at
  `unitPricePaise` = net + GST. `markPlanBillPaid` keeps a prorated bill's period end.
- `billing/next-bill.ts`: `monthPace`, `feesAtPace`, `breakEvenOrders`, `upgradeNudge`,
  `projectNextBill` (existing prices only). `PlanView` gains `pace` and `nudge`; `planUsage`
  gains `salesPaise`.
- **Migration `0248_plan_payment_proration`**: `plan_payment.prorated boolean default false`,
  `plan_payment.credit_paise integer default 0`. Journal `when` 1795189163000 (another branch used
  1795189100000 in the shared test databases; renumber if 0248 clashes).

## How amounts change

- Upgrade mid-period on a paid plan: was the full new price for a fresh period from today (old
  days lost); now new plan × days left / period days − old plan × days left / period days, + 18%
  GST, and the renewal date stays. Growth → Pro on 11 Nov (20 of 30 days left): ₹3,332.67 −
  ₹1,332.67 = ₹2,000.00 + ₹360.00 GST = **₹2,360.00** (was ₹5,898.82).
- Monthly → yearly: full yearly price less the month's unused days (was full yearly).
- Trial, due, paused, or no paid time left: unchanged (variant price, full interval).
- Downgrades: unchanged (scheduled for the period end, no refund).
- Renewals, AutoPay, app and fee bills: unchanged.
- Choosing the current plan and interval with paid time left now fails (was a new full-price
  bill from today).

## Not changed / noticed

- Fee bills place the fee before GST as a GST-inclusive line, so their order total has no GST
  added, while the UI and reminder email say "+ 18% GST". Left alone (not this branch).
- Same plan yearly → monthly is scheduled but the renewal keeps `interval = year` (existing).
