# App roadmap research (2026-10-20)

Which apps and integrations to build next for Indian D2C merchants, ranked. Research only; no code
changed. Read against `origin/dev` at `9dcad184`.

Out of scope, because they are being built now: DHL Express, FedEx, Blue Dart, DTDC, India Post,
Xpressbees, Ekart, Shadowfax couriers; Chatwoot support inbox; Meilisearch search; GrowthBook
A/B tests; GrapesJS email builder; Judge.me reviews import; payments live/test mode.

Sizes follow `docs/architecture.md`: S is up to 2 days, M up to a week, L more than a week.
Licence rules are the ones in `docs/open-source-radar.md` (MIT/BSD/Apache: copy with notice;
GPL/AGPL: ideas or a separate unmodified service; BSL/SSPL/FSL: ideas only). Licences marked
"verified" were read from the repository's licence file through the GitHub API on 2026-10-20.

## What Koomerce already has (checked in the repo)

So these are **not** candidates, or only as an extension of what exists:

| Area | Where it lives | Status |
| --- | --- | --- |
| Gift cards | `packages/core/src/gift-cards`, Products → Gift cards | Exists |
| Returns, exchanges, store credit, RTO tasks | `packages/core/src/returns` (`exchangeReturn`, `storeCreditReturn`, `rto.ts`), Orders → Returns | Exists |
| Wishlist | `apps/storefront/src/components/wishlist`, `data/wishlist.ts` | Exists |
| Size charts | metaobject preset (`packages/core/src/metaobjects/presets.ts`) | Exists as content type, no dedicated app |
| Pre-orders and deposits | `packages/core/src/preorder` | Exists |
| Back in stock, reviews, forms, EMI, GST invoices, Shopify import, Search Console, Umami | `packages/plugin-*` | Exist |
| Meta catalog (Facebook/Instagram/WhatsApp), Google Merchant Center, ChatGPT product feed | `packages/core/src/sales-channels/providers.ts`, Sales channels | Exist |
| WhatsApp messages (Meta Cloud API) | `packages/notifications-whatsapp` | Outbound only, no inbound replies |
| Automations: abandoned cart/checkout, welcome, first order, lapsed, COD confirmation | `packages/core/src/marketing/automation-steps.ts` | Exist; COD confirmation is a one-way message |
| Campaigns, segments, short links, UTM attribution (incl. `affiliate`/`influencer` medium) | `packages/core/src/marketing`, Growth | Exist; no affiliate payouts or portal |
| COD fee / per-method price adjustment | `packages/core/src/payments/adjustments`, Settings → Checkout | Exists |
| Purchase orders, suppliers, transfers, multiple locations | `packages/core/src/inventory`, Stock | Exists (one sellable location) |
| Truecaller, Google One Tap, magic link, passkey login | `packages/core/src/shopper-login` | Exists |
| UPI Autopay (platform billing only) | `packages/core/src/billing/autopay.ts` | Exists for Koomerce's own plans, not for merchants' products |

Not found anywhere in the repo: loyalty points, referrals, bundles, buy X get Y or tiered
discounts (discount methods are only `percent`, `fixed`, `free_shipping`), upsell/cross-sell,
product subscriptions, line item properties (personalisation), SMS, web push, IRN e-invoicing,
e-way bills, Tally/Zoho Books, Unicommerce/EasyEcom, Amazon/Flipkart, ONDC, B2B price lists,
multi-currency (store `currency` defaults to INR and nothing converts), storefront translation,
POS, shoppable video, quizzes.

## Top 8 (P1)

| # | App | Why (Indian D2C) | Approach | Size |
| --- | --- | --- | --- | --- |
| 1 | COD verification and RTO shield | COD is ~60-65% of orders and RTOs 25-40% of them vs 2-3% prepaid | Own code on the existing COD automation, WhatsApp buttons, payment adjustments | M |
| 2 | Bundles, upsell and cross-sell | AOV is the main lever; bundle apps are among the most installed | Own discount engine extension; Medusa (MIT) promotion patterns | M |
| 3 | Loyalty, rewards and referrals | Repeat purchase is where D2C margin is; Nector is the India leader | Own code; Medusa (MIT) recipes as reference | M |
| 4 | GST e-invoicing (IRN) and e-way bills | Mandatory above ₹5 cr AATO; 30-day IRN window above ₹10 cr | Extend the GST invoices app; a GSP API | M |
| 5 | Marketplace and warehouse sync (Unicommerce, EasyEcom) | Brands sell on Amazon, Flipkart, Myntra too; these OMSs are the hub | Connection apps over their REST APIs | M |
| 6 | Accounting sync (Tally, Zoho Books) | Every Indian brand's CA lives in Tally; manual entry today | Own code: Tally XML import file, Zoho Books API | M |
| 7 | Product subscriptions (UPI Autopay) | Replenishment categories (beauty, food, wellness) | Reuse `billing/autopay.ts` patterns on Razorpay/Cashfree subscriptions | L |
| 8 | Shoppable video and UGC | Whatmore and similar are top-rated Indian Shopify apps | Own block; hls.js (Apache-2.0), media-chrome (MIT) | M |

### 1. COD verification and RTO shield (P1, M)

**What.** Turns the existing one-way "COD order confirmation on WhatsApp" automation into a loop:
Confirm / Cancel / Pay now buttons whose replies update the order (inbound webhook from the Meta
Cloud API); an RTO risk score per order (repeat-RTO phone, pincode RTO history from our own
`order.rto` data, address quality, order value, odd hours, duplicate orders); rules per score
(auto-confirm, hold for confirmation, block COD, force partial prepaid); a COD-to-prepaid nudge
with a UPI link and the existing payment adjustment as the incentive; COD limits per pincode and
order value; "unconfirmed after N hours" auto-cancel before the label is printed.

**Why.** Razorpay puts COD at 60-65% of Indian e-commerce orders and COD RTO at 25-30% against
2-3% for prepaid; Base.com's 2026 benchmark says 30-40% for COD. GoKwik's headline pitch is
RTO reduction, and COD-verification apps (COD King: 81% of installs in India) are a whole
Shopify category. We already store RTOs per shipment (`returns/rto.ts`), which is the data a
risk score needs.

**Build.** Own code. Optional address parsing with [libpostal](https://github.com/openvenues/libpostal)
(MIT, verified) as a separate service; start with pincode-to-city/state checks against the
India Post pincode directory (data.gov.in, Open Government Data licence). No open-source RTO
model worth taking. Needs: WhatsApp interactive message templates approved by Meta, a webhook
endpoint for replies.

### 2. Bundles, upsell and cross-sell (P1, M)

**What.** Fixed and mix-and-match bundles, buy X get Y, tiered offers ("₹200 off above ₹1,499"),
volume discounts, frequently-bought-together and cart drawer upsells, a free-shipping progress
bar, post-purchase one-click add (COD orders can simply be amended before dispatch).

**Why.** Bundle/upsell apps are among the most installed on Shopify; a Skai Lama case study
reports ₹12.4M bundle revenue for an Indian beauty brand in a few months; "add ₹199 more for
free shipping" is the standard Indian nudge. Our gap analysis already lists BXGY and tiered
offers as missing (`docs/research/2026-09-oss-commerce-gap-analysis.md` §3).

**Build.** Extend `packages/core/src/discounts` with Medusa's application-method/rule model
([Medusa](https://github.com/medusajs/medusa), MIT outside Enterprise files per the radar;
patterns, not code). Recommendations from co-purchase SQL on orders now, Gorse (Apache-2.0,
radar) later. Bundles as a virtual product whose lines reserve component stock. No external
account.

### 3. Loyalty, rewards and referrals (P1, M)

**What.** Points for orders, reviews, sign-ups and birthdays; tiers; redeem points at checkout
(as store credit, which already exists); refer-a-friend codes with a reward on the friend's
first delivered (not RTO'd) order; a storefront rewards widget and account page.

**Why.** Nector, the India-focused loyalty app, is a Built-for-Shopify app with 4.8 stars and
names brands like XYXX and Headphonezone; Cashfree built Nector point redemption into its
one-click checkout. Rewarding only on delivery is the India-specific twist that generic apps get
wrong (COD RTOs).

**Build.** Own code on the plugin API (the radar's 2026-10-11 decision: loyalty, wishlist, gift
cards and bundles in-house, Medusa as reference). Ledger table, reusing store credit for
redemption. No external account.

### 4. GST e-invoicing (IRN) and e-way bills (P1, M)

**What.** For B2B invoices from the GST invoices app: generate the IRN and signed QR through the
Invoice Registration Portal, print them on the PDF, cancel within 24 hours; generate e-way
bills (Part A from the order, Part B vehicle/transporter from the courier) for consignments over
₹50,000.

**Why.** E-invoicing is mandatory above ₹5 crore AATO, and from 1 April 2025 taxpayers at ₹10
crore and above cannot report invoices older than 30 days (GSTN advisory). A growing D2C brand
crosses ₹5 crore early; today our invoices have no IRN.

**Build.** Own code inside `packages/plugin-gst-invoices`, through a GSP (GST Suvidha
Provider) API such as Masters India, ClearTax or IRIS, or NIC's direct API for eligible
taxpayers. No useful open-source client found (searched GitHub 2026-10-20; the only hit was a
1-star Apache-2.0 MCP server). Needs: a GSP account per merchant (or one platform GSP contract).

### 5. Marketplace and warehouse sync: Unicommerce and EasyEcom (P1, M)

**What.** Connection apps that push products and orders to the merchant's OMS and pull
inventory back, so Amazon, Flipkart, Myntra and Meesho stock stays in sync through the OMS the
brand already uses.

**Why.** Unicommerce claims 8,000+ clients and 270+ integrations; EasyEcom covers Amazon,
Flipkart, Myntra, Meesho and Shopify. Indian D2C brands are rarely website-only, and these OMSs
already integrate Shopify, so a brand moving to Koomerce would lose its sync without this.

**Build.** Own connection plugins over their partner REST APIs. Cheaper than direct
marketplace integrations (see P3 below). Needs: partner/API access from each vendor.

### 6. Accounting sync: Tally and Zoho Books (P1, M)

**What.** Daily sales, returns, credit notes and payment settlements as Tally vouchers (XML
import, or TallyPrime's HTTP XML server when the merchant runs it) and as Zoho Books invoices
via its API, with GST ledger mapping.

**Why.** Tally is the default ledger for Indian SMEs and their CAs; no Indian e-commerce
platform gets past a CA without an export. We already produce GSTR-1 exports, so the tax data
exists.

**Build.** Own code (no maintained open-source Tally connector found on GitHub, 2026-10-20).
Needs: Zoho developer app (OAuth); Tally needs nothing but a file download.

### 7. Product subscriptions (P1, L)

**What.** Subscribe-and-save on products (every 15/30/60 days), skip/pause/swap from the
account page, renewals that create orders, dunning on failed mandates.

**Why.** Replenishment categories (beauty, coffee, pet food, supplements) are a large share of
Indian D2C. RBI's AFA relaxation lets UPI Autopay charge up to ₹15,000 per renewal without the
PIN, which covers nearly every D2C subscription; a mandate is a fixed amount, so price changes
need a new mandate.

**Build.** Own code reusing what `packages/core/src/billing/autopay.ts` does for Koomerce's own
plans, on Razorpay Subscriptions and Cashfree Subscriptions (SDKs in the radar: MIT and
Apache-2.0). Kill Bill (Apache-2.0) for billing-model ideas only. Needs: subscriptions enabled
on the merchant's gateway account.

### 8. Shoppable video and UGC (P1, M)

**What.** Upload or import Instagram Reels, tag products, show them as a stories row, carousel or
floating player on product and home pages, with add-to-cart inside the player; collect customer
photos/videos (with reviews, which already support photos).

**Why.** Whatmore, an Indian shoppable-video app, has a 5.0 rating across 370+ Shopify reviews,
with Indian fashion and jewellery brands reporting conversion lifts; video is how Indian
shoppers buy on Instagram.

**Build.** Own Puck block; transcode on upload to HLS in R2; play with
[hls.js](https://github.com/video-dev/hls.js) (Apache-2.0, verified from LICENSE) and
[media-chrome](https://github.com/muxinc/media-chrome) (MIT, verified) for controls. Instagram
import through the Meta Graph connection that Sales channels already has.

## P2

| App | Exists? | What and why | Approach and licence | Accounts | Size |
| --- | --- | --- | --- | --- | --- |
| DLT-compliant SMS (MSG91, Gupshup) | No | OTP and order SMS for shoppers without WhatsApp; every Indian SMS needs a DLT-registered header and template ID, and OTP/order updates go under "Service Implicit" | Notification provider like `notifications-ses`; template ID per message | MSG91 account, DLT registration (merchant's or platform's) | S |
| Web push | No | Back-in-stock, price-drop and order updates without a phone number | [web-push](https://github.com/web-push-libs/web-push) (MPL-2.0 per radar, use as dependency) | None (VAPID keys) | S |
| WhatsApp shop and broadcasts v2 | Partly (catalog sync, outbound templates) | Browse catalog and order inside WhatsApp, click-to-WhatsApp ad replies, broadcast to segments; the Interakt/Gallabox/WATI pitch. Vendors claim ~25% WhatsApp cart recovery vs 4-5% email (unaudited) | Own code on Meta Cloud API; reuse the inbound webhook from item 1; Chatwoot (in progress) handles human replies | Meta WABA | M |
| Product options and personalisation | No | Engraving, gift messages, custom names, extra options beyond 3 variants; jewellery, gifting and apparel need it | Line item properties on cart/order lines, option sets per product, price add-ons | None | M |
| Affiliate and influencer programme | Partly (UTM `affiliate` medium, short links) | Creator codes and links, commission on delivered orders, payout report, creator portal; influencer marketing is the top Indian D2C acquisition channel | Own code on `marketing/attribution.ts` and short links. Dub is a trap (affiliates in its commercial `(ee)` folder, radar) | Optional RazorpayX for payouts | M |
| Address autocomplete and pincode check at checkout | Partly (pincode serviceability) | Fewer bad addresses, fewer RTOs; feeds item 1 | Google Places, Ola Maps or Mappls API behind one provider interface | Maps API key | S |
| ONDC seller | No | Reach ONDC buyer apps (Paytm, PhonePe Pincode, Magicpin). ONDC passed 12M monthly orders in July 2024, but retail orders fell from 65 lakh (Oct 2024) to 45 lakh (Feb 2025), so demand is uncertain | [beckn-onix](https://github.com/beckn/beckn-onix) (MIT, verified, pushed 2026-10-01) as the protocol adapter; [ONDC reference implementations](https://github.com/ONDC-Official/reference-implementations) (MIT, verified) for message shapes. Or partner with an existing seller app (Shiprocket, SellerApp) | ONDC registration, subscriber ID | L |
| Quiz and product finder | No | Skin-type, size and gift finders for beauty and apparel; captures zero-party data | Puck section, answers in metaobjects (radar: OpnForm/HeyForm are AGPL, ideas only) | None | S |
| B2B and wholesale | No | Price lists per customer group, MOQ, GST-number checkout, net terms; many D2C brands also sell to retailers | Own code; Saleor (BSD) and Medusa (MIT) price-list patterns | None | L |

## P3

| App | Exists? | Notes | Size |
| --- | --- | --- | --- |
| Direct Amazon SP-API and Flipkart listings | No | Only after the OMS route (item 5); [amazon-sp-api](https://github.com/amz-tools/amazon-sp-api) (MIT, verified) as a library; Flipkart Seller API has no open-source client | L |
| Multi-currency for exports | No | Display prices in USD/AED/GBP with rounding rules; charge through Stripe or Razorpay international. Rates from [Frankfurter](https://github.com/lineofflight/frankfurter) (MIT, verified). Needs GST export-invoice handling (LUT) | M |
| Storefront translation (Hindi and regional) | No (admin has Hindi) | Translated product and page fields per locale, hreflang, AI translation through `packages/ai`. LibreTranslate is AGPL (ideas only) | M |
| Accessibility checker | No | Scan theme pages in the editor and list issues; [axe-core](https://github.com/dequelabs/axe-core) (MPL-2.0, verified) used unmodified as a dependency | S |
| POS for pop-ups and exhibitions | No | Browser POS on a phone/tablet using the same inventory, UPI QR at the counter; useful for brands doing flea markets and exhibitions | L |
| Size chart app | Exists as metaobject preset | A guided size-chart builder and "find my size" could make it an app; low priority since the content type works | S |

## Suggested order

1. COD verification and RTO shield (it also builds the WhatsApp inbound webhook that the
   WhatsApp shop and Chatwoot hand-off reuse).
2. Bundles and upsell, then loyalty and referrals (both touch the discount and store credit
   code; do them back to back).
3. GST e-invoicing and Tally/Zoho Books (one "finance" stream, same GST data).
4. Unicommerce/EasyEcom connections.
5. Shoppable video; subscriptions after the payments live/test work lands.
6. P2 quick wins in between: DLT SMS, web push, address autocomplete, quiz.

## Sources

- Razorpay, [Cash on delivery and its challenges](https://razorpay.com/blog/cash-on-delivery-and-the-challenges/) (COD share and RTO rates)
- Base.com, [India Ecommerce Benchmarks 2026](https://www.base.com/en-IN/blog/india-ecommerce-benchmarks-2026-how-brands-reduce-rto-in-india-and-hit-accuracy-sla-targets)
- Social Samosa, [Prepaid e-commerce orders rise to 41%](https://www.socialsamosa.com/report/prepaid-e-commerce-orders-rise-10958917)
- EasySell, [Best Shopify COD verification apps 2026](https://easysellapp.com/blogs/wiki/best-shopify-cod-verification-apps-2026); HillTeck, [COD verification apps](https://www.hillteck.com/blog/best-cod-verification-apps-shopify.html) (vendor-written)
- The D2C Pulse, [Best Shopify apps for Indian D2C brands 2026](https://thed2cpulse.com/d2c-tech-stack/best-shopify-apps-indian-d2c-brands-2026/); eChai, [Essential Shopify app stack](https://echai.ventures/d2c/d2c-tech-stack-apps/essential-shopify-app-stack-new-brand)
- Wiser Review, [GoKwik alternatives](https://wiserreview.com/blog/gokwik-alternatives/), [Shopflo alternatives](https://wiserreview.com/blog/shopflo-alternatives/)
- GSTN advisory, [30-day IRN reporting at AATO ₹10 crore](https://www.mahagst.gov.in/public/uploads/gstnadvisory/1760531580_293%20Advisory%20Time%20Limit%20for%20Reporting%20e%20Invoice%20on%20the%20IRP%20Portal%20%20Lowering%20of%20Threshold%20to%20AATO%2010%20Crores%20and%20Above.pdf); Vyapar, [e-invoicing applicability](https://vyaparapp.in/blog/e-invoicing-applicability-turnover-limit-india/)
- MSG91, [DLT content approval](https://msg91.com/help/MSG91/get-approval-for-your-sms-content-on-dlt-platform); Fyno, [DLT templates](https://fyno.io/docs/dlt-sms-templates)
- Edesy, [WhatsApp cart recovery](https://edesy.in/whatsapp-marketing/features/whatsapp-cart-recovery) (vendor claims); Interakt [Shopify listing](https://apps.shopify.com/interakt-marketing); Gallabox [cart recovery](https://gallabox.com/blog/whatsapp-cart-recovery)
- Nector, [Shopify listing](https://apps.shopify.com/nector-rewards-loyalty), [Cashfree x Nector](https://www.cashfree.com/blog/from-checkout-to-retention-with-nector-one-click-checkout-by-cashfree-payments/); eChai, [Loyalty and referral tools](https://echai.ventures/d2c/d2c-community-loyalty/which-loyalty-referral-tools-to-use)
- Skai Lama, [Indian beauty brand bundling case study](https://www.skailama.com/case-study/beauty-brand-shopify-bundling-case-study); Edesy, [Shopify upsell India](https://edesy.in/shopify-upsell/in/india)
- AppNavigator, [Whatmore](https://appnavigator.io/app/whatmore-live); Vizup, [Shoppable video for fashion in India](https://vizupcommerce.com/best-shoppable-video-app-for-fashion-stores-in-india/)
- PhonePe, [UPI AutoPay vs e-NACH vs cards](https://business.phonepe.com/articles/how-to-accept-subscription-payments-in-india-upi-auto-pay-vs-e-nach-vs-cards); Paddle, [UPI AutoPay](https://developer.paddle.com/changelog/2026/upi-autopay/)
- Unicommerce, [vs Base](https://unicommerce.com/unicommerce-vs-base-comparison/); EasyEcom, [integrations](https://easyecom.io/integration)
- IndBiz, [ONDC 12M orders in July](https://indbiz.gov.in/ondc-hits-new-milestone-with-12-million-orders-in-july); Policy Circle, [ONDC growth pangs](https://www.policycircle.org/industry/ondc-faces-growth-pangs-e-commerce/)

Most install and uplift numbers above come from vendors; treat them as direction, not proof.
