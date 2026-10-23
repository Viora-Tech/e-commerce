# Affiliate apps: market scan, India rules, open source, v1 scope

Written 23 October 2026 for the built-in Affiliates app. Sources were read on 2026-10-23. Prices
come from vendor pages where we could load them; where only third-party pages were available
this says so. Prices are USD per month unless noted. Tax points are research notes, not
tax advice: a CA should check the TDS and GST sections before we ship merchant-facing copy.

## Summary

1. **The market splits three ways.** UpPromote and GoAffPro are cheap all-rounders with free
   tiers. Refersion, Social Snowball and impact.com charge a subscription plus a share of
   affiliate revenue (1-3%), and Social Snowball starts at $249/month. Shopify Collabs and
   Dub add a fee on the payout itself (2.9% and 3-5%).
2. **Merchants complain about four things, in this order:** fraud and over-attribution
   (affiliates hijacking existing coupons or UTMs, self-referrals, coupon-leak sites), billing
   (surprise plan upgrades, charges after uninstall, revenue-share fees that grow faster than
   sales), slow support, and commission paid on refunded orders. Lost tracking comes up less
   often than we expected. Coupon attribution hides it, because a coupon still credits the
   affiliate when the cookie is lost.
3. **No global app fits India well.** Automatic payouts are PayPal, Wise or Stripe-style. UPI
   and bulk NEFT/IMPS files are not supported. Shopify Collabs creators must live in the US,
   Canada or the UK ([Influencer Hero](https://www.influencer-hero.com/blogs/shopify-collabs-pricing-and-review)).
   The one India-native Shopify app we found, ReferRush (Bangalore), sells "UPI payouts + TDS
   tracking" as its main feature, which shows the gap is real.
4. **TDS (verified):** commission is taxed under **section 194H at 2%**, cut from 5% on
   1 October 2024. The yearly threshold went from **₹15,000 to ₹20,000 on 1 April 2025**. Without
   a PAN the rate is **20%**. From 1 April 2026 the Income-tax Act, 2025 moves this to
   **section 393(1), Table Sl. No. 1(ii)**, with the same 2% and ₹20,000.
5. **COD and RTO change the commission lifecycle.** With about 45% COD and 20-40% RTO on COD
   orders, paying commission when the order is placed means paying for parcels that come back.
   A commission must stay `pending` until the order is delivered and the return window has
   closed.
6. **The open-source options don't fit.** Dub's partner programme is under a commercial `(ee)`
   licence, and RefRef is AGPL-3.0. Weferral is MIT but stale, and Refferq is MIT but small and
   of uncertain origin. All are SaaS referral tools built around Stripe, not order-lifecycle
   commerce.
7. **Verdict: build it ourselves.** It is a small module on our order outbox, discount engine
   and storefront beacon. We take product ideas from UpPromote, GoAffPro and Dub, and no code.

---

## 1. Per-app notes

### UpPromote (Secomapp)
- **Rating:** 4.9 from about 3,259 reviews, the market leader by volume ([listing](https://apps.shopify.com/affliate-by-secomapp)).
- **Pricing ([vendor page](https://uppromote.com/pricing/)):** Free up to $3,000/month in referral
  revenue. Growth is $29.99 plus 2%, Professional $89.99 plus 1.5%, Enterprise $199.99 plus 1%.
  The fee is charged on approved referral sales. Yearly billing saves 17%. Creator Discovery is
  a $39/month add-on.
- **Features:** link, coupon and email tracking. Per-order-value commission levels. Special
  per-product commissions, capped at 15 products below Professional. MLM from Professional up.
  Lifetime commission, store-credit payouts, PayPal auto-pay, Wise bank transfer, IP blocklists.
- **Loved:** setup, support, and a feature set that is complete for the price.
- **Hated:** paywalled limits (one coupon per affiliate, 15 product overrides, referral-order
  caps), a learning curve over which settings live in UpPromote and which in Shopify, and
  coupons that don't follow an affiliate who moves between programmes
  ([ecommercefastlane](https://ecommercefastlane.com/?p=206110), [ainfluencer](https://ainfluencer.com/uppromote/)).

### GoAffPro
- **Rating:** 4.6 from 952 reviews, with 38 one-star
  ([reviews](https://apps.shopify.com/Goaffpro/reviews)).
- **Pricing:** a free Hobby plan for stores under 100 orders a day, with unlimited affiliates and
  sales. Premium is $49 and Business $99, both flat with no revenue share
  ([xpay snapshot, May 2026](https://www.xpay.sh/saas-pricing/goaffpro/), [Modash](https://www.modash.io/blog/goaffpro-vs-refersion)).
- **Features:** MLM, targets and bonuses, multiple groups and sign-up pages, branded portal,
  PayPal Payouts. Any other method is "record a payout you made elsewhere"
  ([wordpress.org](https://wordpress.org/plugins/goaffpro/)). This is the manual mark-paid model
  we plan to copy.
- **Loved:** the generous free tier. A guide calls it the default first app for Indian D2C
  brands ([eChai](https://echai.ventures/d2c/from/goaffpro-com)).
- **Hated:** fraud. Merchants report affiliates "hijacking Rebuy and existing discount codes and
  utm parameters" (Jul 2026) and 100% discount codes being created. Others report support that
  ghosts them and a surprise upgrade to Premium (Mar 2026).

### Refersion
- **Rating:** 4.8 from 495 reviews ([reviews](https://apps.shopify.com/refersion/reviews)).
- **Pricing ([vendor page](https://refersion.com/pricing)):** a free Marketplace listing. Launch
  is $39 ($29 yearly) plus 3% of affiliate sales. Growth is about $199 ($159 yearly) plus 2%,
  per third parties ([Referly](https://www.referly.so/pricing/refersion-pricing)). Scale is
  custom, for over $1M GMV. A plan was added in July 2026
  ([CostBench](https://costbench.com/changelog/refersion-plan-added-2026-07/)).
- **Features:** SKU-level commissions, a marketplace, multi-store, Zapier.
- **Hated:** fees that outweigh the sales they bring in ("hasn't generated enough sales to even
  cover its fees"), annual contracts that are hard to leave, hard setup, thin support.

### Social Snowball (owned by dotdigital since mid-2025)
- **Rating:** 4.6 from 211 reviews ([reviews](https://apps.shopify.com/social-snowball/reviews)).
- **Pricing:** custom quotes. Snow Day is about $249 plus 3% per third parties, and Blizzard
  starts at $899/month ([listing](https://apps.shopify.com/social-snowball), [ainfluencer](https://ainfluencer.com/social-snowball/)).
- **Features:** every customer becomes an affiliate automatically after purchase, tiers, Meta
  creator search, TikTok Shop support, instant payouts.
- **Loved:** hands-off once set up, auto-enrolment, analytics.
- **Hated:** charges continue after uninstall (Apr 2026), creator search gated behind Meta
  business verification, over-attribution, scammers.

### Shopify Collabs
- **Fees:** 2.9% of the commission (not the sale) on automatic payouts. The holding period is
  1-90 days, 30 by default, and refunds inside it are clawed back. Creators need $25 minimum
  before payout. PayPal or bank only, and manual payments ended 8 January 2024
  ([Influencer Hero](https://www.influencer-hero.com/blogs/shopify-collabs-pricing-and-review), [makeinfluence](https://www.makeinfluence.com/en/academy/shopify-collabs-how-shopifys-native-affiliate-tool-works)).
- **Limits:** creators must live in the US, Canada or the UK and have 1,000+ followers. The open
  network needs $10k in trailing sales. We found no evidence that it works in India.
- **Hated:** sales credited to the wrong creator, commission on refunds, affiliates earning on
  their own orders, frozen payouts in unsupported countries
  ([appnavigator](https://appnavigator.io/app/collabs/)).
- **Lesson:** "holding period plus clawback" is the industry-standard model, and a native
  platform tool is the bar we are measured against.

### impact.com
- **Pricing (Shopify listing):** Starter costs the greater of $30 or 2.5% of monthly revenue.
  Essentials is $500 and Professional $2,500 ([listing](https://apps.shopify.com/impact-1)).
- **Fit:** enterprise partnership software with contracts, a network, and tax forms (W-9/W-8).
  Far too much for an Indian D2C SMB.

### Rewardful
- **Pricing:** about $49-149/month, restructured February 2026
  ([CostBench](https://www.costbench.com/changelog/rewardful-plans-renamed-2026-02/)).
- **Fit:** built for Stripe SaaS subscriptions (recurring commission on Stripe invoices). Not
  relevant to Shopify-style orders, though its "recurring commission for N months" idea maps to
  our lifetime window.

### ReferralCandy
- **Pricing:** a subscription plus a success fee. One 2026 guide lists Basic at $39 plus 10.5%,
  Grow $79 plus 3.5%, Scale $249 plus 1.5%. Another lists $59 plus 3.5%. The sources conflict
  ([Rivo](https://www.rivo.io/blog/referralcandy-pricing), [Firebear](https://firebearstudio.com/blog/referralcandy-review.html/423)).
- **Fit:** customer-to-customer referral (two-sided "give ₹X, get ₹X"), not creator affiliates.
  It overlaps with our loyalty plans more than with affiliates.

### Notable newcomers
- **Dub Partners** ([pricing](https://dub.co/pricing)): Business $90 (payouts up to $2.5k/month,
  5% payout fee), Advanced $300 (risk monitoring, embedded referral dashboard), Enterprise
  custom at 3%. Includes global payouts, tax compliance, bounties and dual-sided incentives.
  This is the best modern portal UX to learn from, but it is SaaS-first.
- **ReferRush** ([listing](https://apps.shopify.com/referrush)): Revcommerce, Bangalore,
  launched April 2024, 5.0 from 13 reviews. Automatic UPI payouts and TDS tracking. Grow is $75
  plus 2.5%, Scale $175 plus 1.5%, Enterprise $500 plus 0.5%. The only India-native competitor
  we found.

---

## 2. Feature matrix

✓ = yes, ~ = partial or higher tier only, ✗ = no, ? = unconfirmed.

| Feature | UpPromote | GoAffPro | Refersion | Social Snowball | Collabs | impact.com | Dub Partners | ReferRush | **Koomerce v1** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| % / flat commission | ✓ | ✓ | ✓ | ✓ | % only | ✓ | ✓ | ✓ | ✓ |
| Product/collection overrides | ~ (15 below Pro) | ✓ | ✓ (SKU) | ✓ | ~ | ✓ | ~ | ? | ✓ |
| First-order vs lifetime | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ? | ✓ (with window) |
| Coupon attribution | ✓ (1 code below Pro) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (our discount engine) |
| Link/cookie tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (consent-aware beacon) |
| Hold period / return window | ✓ | ✓ | ✓ | ✓ | ✓ (1-90 d) | ✓ | ✓ | ? | ✓ (delivered + return window) |
| Auto-reversal on refund | ~ | ~ | ✓ | ✓ | ✓ in hold | ✓ | ✓ | ? | ✓ (refund, cancel, RTO) |
| Tiers / MLM | ✓ MLM (Pro) | ✓ MLM | ~ | tiers | ✗ | ~ | ✗ | ? | tiers optional, no MLM |
| Affiliate portal | ✓ | ✓ | ✓ | ✓ | creator app | ✓ | ✓ (best UX) | ✓ | ✓ /affiliate |
| Payouts | PayPal, Wise, store credit | PayPal + manual | PayPal, manual | instant, PayPal | PayPal, bank (US/CA/UK) | global | global (fee) | **UPI** | mark-paid + bank CSV, UPI details |
| Tax forms / TDS | ✗ | ✗ | W-9 | ✗ | W-9 | W-9/W-8 | ✓ (US) | **TDS** | **TDS 194H / 393** |
| Creator discovery | add-on $39 | ✗ | marketplace | Meta search | network | network | Enterprise | ✗ | ✗ |
| Pricing model | free → $199.99 + 1-2% | free → $99 flat | $39 + 3% → custom | ~$249 + 3% → $899 | 2.9% of payout | $30 / 2.5% → $2,500 | $90 → $300 + 3-5% | $75 + 2.5% → $500 | included |

---

## 3. India

### Payouts
- **Rails:** UPI for small amounts and bank NEFT/IMPS for larger ones. Banks accept bulk-payout
  files (CSV/XLS with beneficiary name, account number, IFSC, amount, narration). Payout APIs
  exist (RazorpayX, Cashfree Payouts), but they bring KYC, a funded current account and
  liability. For v1 we generate the bulk file and the merchant marks rows paid.
- **Store credit** is a popular zero-cash option. It fits our existing customer balance or gift
  card work, if any (v2).

### TDS on commission: section 194H, renumbered section 393(1) from 1 April 2026
- **Rate:** **2%**, cut from 5% for payments on or after 1 October 2024 (Finance (No. 2) Act
  2024) ([ClearTax](https://cleartax.in/s/section-194h-tds-on-commission-brokerage), [TaxBuddy](https://www.taxbuddy.com/blog/section-194h-tds-rate-in-2025-detailed-explanation)).
- **Threshold:** **₹20,000** in total per affiliate per financial year from 1 April 2025, up from
  ₹15,000 (Finance Act 2025) ([TDSMan](https://blog.tdsman.com/2025/08/tds-under-section-194h-brokerage-and-commission/), [TaxBuddy](https://www.taxbuddy.com/blog/tds-threshold-limit-under-194h-in-fy-2025-26)).
  Once crossed, TDS applies to the whole year's amount, not just the excess.
- **No PAN:** **20%** under section 206AA ([TaxBuddy](https://www.taxbuddy.com/blog/tds-deduction-under-section-194h)).
  We must collect the PAN before the first payout and flag affiliates without one.
- **New Act:** the Income-tax Act, 2025 took effect 1 April 2026. Commission is now
  **section 393(1), Table Sl. No. 1(ii)**, still 2%, still ₹20,000, return in Form 26Q
  ([TDSMan, Jun 2026](https://blog.tdsman.com/2026/06/tds-on-brokerage-and-commission-section-3931-section-194h/)).
  UI copy should say "TDS on commission (s. 393, formerly 194H)" and keep the rate and threshold
  configurable, not hardcoded.
- **Who deducts:** the merchant as payer. Individual or HUF payers deduct only if their
  turnover crossed the tax-audit limit in the previous year
  ([TaxBuddy](https://www.taxbuddy.com/blog/tds-deduction-under-section-194h)). This is a
  per-store setting, on by default for companies.
- **When:** TDS is due on credit or payment, whichever comes first. So the ledger should
  compute TDS when a commission becomes `approved` (credited), not at payout.
- **Section 194-O is not relevant.** It applies to an e-commerce operator facilitating sales by
  third-party sellers (0.1% from 1 October 2024; [ClearTax](https://cleartax.in/s/section-194o)).
  A merchant's own storefront is not that, and an affiliate is not a seller. It would matter
  only if Koomerce ever runs a multi-seller marketplace. Note this and move on.

### GST on affiliate invoices
- Affiliate or marketing services are taxable at **18%** under forward charge. They are not in
  the reverse-charge list (Notification 13/2017-CT(R),
  [GST Council](https://gstcouncil.gov.in/node/4434)), so a registered affiliate charges GST on
  their invoice and the merchant can claim input tax credit.
- **Registration threshold:** ₹20 lakh in all-India aggregate turnover for services (₹10 lakh in
  some special-category states). Inter-state service suppliers below it are exempt from
  compulsory registration (Notification 10/2017-IT,
  [TaxScan](https://www.taxscan.in/?p=12102)). Most micro-creators are unregistered, so the
  payout is the plain commission. For a registered affiliate it is commission plus GST, minus
  TDS. Under Indian practice TDS is computed on the amount excluding GST when GST is shown
  separately. Confirm this with a CA.
- **v1:** store an optional GSTIN on the affiliate. If set, payout rows carry
  `gst_amount = 18% × commission` for the merchant to reconcile. Generating GST invoices for
  affiliates is v2.

### Creators and orders
- **Instagram and WhatsApp creators** share links in bio, stories and broadcast lists, and
  many of these clicks open inside in-app browsers that lose cookies. A memorable
  **per-affiliate coupon** (`PRIYA10`) is therefore the main attribution path in India, and the
  `?ref=` link is secondary. The portal should make both one-tap copyable and include a
  WhatsApp share button.
- **COD and RTO:** COD is about 45% of D2C orders in 2026. Average RTO is 20-30%, and 30-40% for
  COD in fashion ([base.com](https://base.com/en-IN/blog/?p=22444), [hillteck](https://hillteck.com/blog/rto-trends-2026-indian-d2c.html)).
  Commission is created as `pending` on order placement, becomes `approved` only after
  `delivered + return_window_days`, and is reversed on cancel, RTO or refund (pro-rata for a
  partial refund).
- **Indian tools:** ReferRush is the only India-native affiliate app with UPI and TDS. Winkl,
  Grynow and Kofluence are creator discovery and campaign agencies, not tracking or payout tools
  ([eChai](https://echai.ventures/d2c/d2c-influencer-affiliate/influencer-affiliate-platforms-to-use-india)).
  GoKwik, Shopflo and Wigzo are checkout or marketing tools. We found no affiliate products from
  them, so treat any claim otherwise as unverified.

---

## 4. Open source

Our rule: MIT, BSD or Apache code may be adapted with a notice in `THIRD_PARTY_NOTICES.md`.
GPL, AGPL and source-available code is ideas only. Licences below were checked through the
GitHub API and vendor pages on 2026-10-23.

| Project | Licence (verified) | Activity | What it is | Use |
| --- | --- | --- | --- | --- |
| [Dub](https://github.com/dubinc/dub) (Partners) | AGPL-3.0 core; partners and affiliate code in `(ee)` under a commercial licence (radar, 2026-10-11) | very active, about 25k stars | Short links, partner programmes, payouts | **Ideas only.** Best reference for portal UX, bounties and fraud "risk monitoring" |
| [RefRef](https://github.com/refrefhq/refref) | **AGPL-3.0** | 237 stars, last push 2026-03 | Next.js + Drizzle referral and affiliate platform | Ideas only |
| [Refferq](https://github.com/Refferq/Refferq) | MIT | 131 stars, created 2025-10, active | Next.js + Postgres SaaS referral tool | Permissive on paper, but its tagline mirrors the older AGPL RefRef word for word. Check its origin before taking anything. SaaS and Stripe-shaped, so low value anyway |
| [Weferral](https://github.com/WeferralHq/weferral) | MIT | 290 stars, last push 2024-06, "not production ready" | Node + Postgres affiliate programme | Stale. Ideas at most |
| [SliceWP](https://wordpress.org/plugins/slicewp/) | GPL (wordpress.org requires GPL-2.0-or-later); paid add-ons | 10k+ installs, updated Oct 2026 | WooCommerce affiliate plugin | Ideas only (commission rates per product, affiliate coupons) |
| AffiliateWP | Commercial (GPL code, paid licence) | — | WP affiliate plugin | Ideas only |
| Kutt / Shlink | MIT | active | Short links | Not needed: `?ref=` on the store domain is enough |

No permissive project models our hard parts: order-lifecycle holds, RTO reversal, the TDS
ledger, and discount-engine coupons. There is nothing worth adapting.

---

## 5. Build vs adopt

**Build natively.** The reasons, honestly weighed:

- **For building:** the hard parts are commerce events we already own. Commission state has to
  follow `order.paid`, `order.delivered`, `order.cancelled`, `order.rto` and `refund.created`
  from our outbox, with idempotency. Coupons must be real codes in our discount engine, not a
  parallel system. Attribution must use our storefront beacon and consent banner. An external
  app would rebuild all three through webhooks, and webhooks are exactly where the Shopify apps
  lose sales and pay on refunds.
- **For building (India):** no candidate does UPI or bank-file payouts plus TDS plus COD-aware
  holds except ReferRush, which is a closed Shopify app.
- **For building (business):** competitors charge 1-3% of affiliate revenue or 2.9-5% of
  payouts. "Included in your plan" is a selling point against UpPromote and ReferRush.
- **Against building:** fraud tooling and creator discovery are where the vendors invest
  heavily, and we won't match them in v1. Real payouts need a regulated partner. We scope both
  out.
- **Effort:** schema + engine M, portal + admin M, tests S. One focused PR series.

---

## 6. Our v1 scope

### Programmes
- Commission type: **percent or flat** per order. The base is the order subtotal after
  discounts, excluding shipping and GST.
- **Product and collection overrides** (rate or flat per line, most specific wins).
- **First order only** or **lifetime** with a window (for example 12 months from the customer's
  first attributed order). Customer-affiliate binding happens at the first attributed order.
- **Cookie window** in days (default 30), last-click. A coupon beats a cookie when both are
  present.
- **Approval mode:** auto-approve applicants, or manual.
- **Minimum payout** (for example ₹500).
- **Hold:** commission `pending` → `approved` at `delivered_at + return_window_days`. Cancel,
  RTO or full refund → `reversed`. Partial refund → pro-rata adjustment. If the commission was
  already approved or paid, write a negative adjustment row and net it from the next payout.

### Affiliates
- **Apply page** on the storefront (`/affiliate/apply`) collecting name, email, phone, social
  handles, PAN (optional at apply, required before payout) and GSTIN (optional).
- Admin **approve or reject**, with an email in either case.
- `?ref=CODE` link, plus a **per-affiliate coupon created in our discount engine** (the
  programme sets the customer discount).
- Optional **tiers** (for example a higher rate after ₹1L in sales a quarter). Recalculated on
  approval, never retroactive in v1.

### Tracking
- A storefront beacon sets a first-party `ref` cookie **only after analytics consent**. Without
  consent, attribution is coupon-only. The order stores `affiliate_id`, `attribution_source`
  (`coupon` | `link`) and `ref_clicked_at`.
- **Coupon attribution** through the discount engine at checkout.
- **Fraud guards:** block self-referral where the customer's email, phone or shipping address
  matches the affiliate's (normalised). Flag duplicate affiliate accounts by PAN, phone or
  bank/UPI. Cap commission at one per order. Show suspicious orders in admin for review, not as
  silent rejections.

### Portal at `/affiliate`
- Customer-account login (the affiliate is linked to a customer record).
- Stats: clicks, orders, pending, approved and paid amounts, with a status explainer
  ("pending until delivered + 7 days").
- Copy link, copy coupon, WhatsApp share.
- Payout details: UPI VPA or bank (account number, IFSC, holder name), PAN, GSTIN. Stored
  **encrypted at rest** and masked in the UI and logs.

### Admin
- **Overview:** revenue from affiliates, commission owed, top affiliates.
- **Affiliates:** list, applications, approve or reject, edit rate or tier.
- **Commissions ledger:** every row with its status (`pending`, `approved`, `reversed`, `paid`),
  the order link and the reason.
- **Payouts:** batch approved commissions above the minimum. **Mark paid** (manual, with a UTR
  or reference). **Export a CSV for bank bulk upload** (beneficiary, account, IFSC or VPA,
  amount, narration).
- **TDS:** per-store toggle. Rate 2% and threshold ₹20,000 per financial year as **configurable
  settings**, 20% if no PAN. Deducted when a commission is credited (approved). The payout batch
  shows gross, TDS and net, with a per-quarter TDS report for the merchant's Form 26Q filing.

### Notifications
- To the affiliate: application approved or rejected, new sale (pending), commission approved,
  payout sent.
- To the merchant: new application, payout batch ready.

### Outbox events
- `affiliate.applied`, `affiliate.approved`, `affiliate.rejected`
- `affiliate.commission_created`, `affiliate.commission_approved`, `affiliate.commission_reversed`
- `affiliate.payout_created`, `affiliate.payout_paid`
- Consumed by notifications and the automation engine. Idempotent on `(order_id, affiliate_id)`.

### Not in v1
- Moving real money or calling payout APIs (RazorpayX, Cashfree Payouts, PayPal).
- MLM or multi-level commissions.
- A creator marketplace or discovery network.
- **GST invoice generation for affiliates (v2).** v1 only stores the GSTIN and shows the GST
  amount on payout rows.
- Automatic TDS filing (26Q, Form 16A). v1 exports the data only.
- Store-credit payouts (v2, once a customer balance exists).
- Two-sided customer referral ("give ₹100, get ₹100", ReferralCandy-style). That belongs to
  loyalty.

### As built (PR feat/app-affiliates)

The v1 that shipped follows this scope, with these differences:

- Signup and dashboard share one route, `/affiliate`. Applying needs a store account, and the
  account supplies the email and phone. PAN is optional and collected with the payout details.
  GSTIN is not collected.
- Approved and pending commissions are reversed or scaled down. A commission already in a payout
  (or paid) is left alone: no negative adjustment rows yet, and the merchant settles any
  clawback by hand.
- Rejected applicants are not emailed. Only approved, new sale and payout sent are.
- Link clicks are recorded only with analytics consent (the existing beacon). Codes always count.
- TDS is deducted when a commission is approved (credited), at 2% with a PAN and 20% without,
  once the financial year's total passes ₹20,000. All three are merchant-editable.
