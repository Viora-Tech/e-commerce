# Koomerce pricing (decided 2026-10-28)

Replaces the pricing of 2026-10-18. Full design: `docs/superpowers/specs/2026-10-28-pricing-revamp-design.md`.

Prices exclude 18% GST. No free plan: every new store gets a 14-day trial at Growth level, no card needed. Orders and visits are never blocked.

## Plans (India)

| | Starter | Growth | Pro | Scale |
|---|---|---|---|---|
| Monthly | ₹499 | ₹1,999 | ₹4,999 | ₹14,999 |
| Yearly (2 months free) | ₹4,990 | ₹19,990 | ₹49,990 | ₹1,49,990 |
| Orders included / month | 50 | 200 | 500 | 2,000 |
| Fee per order after that | 1% | 0.75% | 0.5% | none, ever |
| Fair-use visits / month | 25,000 | 1,00,000 | 5,00,000 | by hand |
| AI credits / month | 500 | 3,000 | 8,000 | 15,000 |
| Staff (owner included) | 1 | 3 | 10 | 25 |
| Storage | 5 GB | 10 GB | 50 GB | 100 GB |
| Shopify theme import | no | yes | yes | yes |
| Included apps | Core only | + Reviews, Back in stock, Forms | All first-party apps | All first-party apps |
| MCP & API, multiple locations | no | no | yes | yes |
| Support | Email | Email + WhatsApp | Priority | Priority |

## Per-order fee

- Counted per IST calendar month, on the order total as paid (items after discounts + shipping + tax).
- Counts: COD, part refunds (whole order). Doesn't count: cancelled, refunded in full before the bill, test orders, orders during the trial or while unpaid/paused.
- Rate and included orders = the plan the store was on when the order was placed (upgrade applies from that moment).
- Billed on the 1st as a separate sales-store order with a pay link; under ₹100 it carries to the next month.
- Unpaid fee bill never pauses the store; it is added to the next plan bill. AutoPay stores still get a pay link.
- The old "₹49 per 100 orders" is gone (it was never billed).

## Fair use (visits)

Analytics sessions (bots excluded). Over the plan's visits two months running: admin notice, email to the owner and support, then a person reaches out. Never blocked, slowed or billed.

## Metered on every plan

- **AI credits**: 1 credit = ₹0.10 of model cost. Top-up ₹199 per 1,000 credits (keeps 50%).
- **WhatsApp**: Meta bills the merchant's own WhatsApp Business account directly; no markup.

## Own it (license)

- ₹49,999 one-time; care ₹3,000/month, 12-month minimum; optional setup ₹7,500. Sold via "Talk to us", not self-serve.
- 0% fee, unlimited orders; the brand runs its own server. One brand per license; not resold or sublicensed; no competing SaaS.
- Care covers updates, security and bug fixes, help applying updates, email/WhatsApp support within 48 h. Not feature requests or problems from their own code or server.

## Regional prices (stored, hidden until Stripe/PayPal)

`REGIONAL_PRICING_LIVE = false` in `packages/core/src/billing/regional-prices.ts`.

| | Starter | Growth | Pro | Scale | Own it |
|---|---|---|---|---|---|
| Tier 1 (US, UK, EU, JP, AU, CA, SG, AE), USD | $19 | $49 | $129 | $349 | $1,999 + $99/mo |
| Tier 1, GBP | £15 | £39 | £99 | £279 | |
| Tier 1, EUR | €17 | €45 | €119 | €319 | |
| Tier 1, JPY | ¥2,900 | ¥7,500 | ¥19,800 | ¥52,000 | |
| Tier 2 (rest of world), USD | $12 | $29 | $79 | $199 | $1,299 + $69/mo |

Yearly = 10× monthly everywhere. Fee rates and included orders are the same in every region.

## Profit check (worst case per store, India)

| | Starter | Growth | Pro | Scale |
|---|---|---|---|---|
| Kept after AI, server share, payment fee, R2, email | 78% | 78% | 75% | 82% |

Servers ≈ ₹3,000/month (Lightsail, ECR, Hetzner): covered from about 5 paying stores before any per-order fee. The server share per store is an estimate; measure it once real stores are live.

## Sales store setup (owner, before release)

Growth variants ₹1,999 / ₹19,990; product Scale with SKUs `plan-scale-month` ₹14,999 and `plan-scale-year` ₹1,49,990; product "Per-order fees" with SKUs `usage-fee-starter`, `usage-fee-growth`, `usage-fee-pro`, `usage-fee-carried` (price set by the bill), not stock-tracked, taxed at 18%.
