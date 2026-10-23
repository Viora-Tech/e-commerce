# Platform apps: what Koomerce must register on other platforms (23 Oct 2026)

Which apps, extensions or partner registrations Koomerce itself has to own on outside
platforms so merchants can connect in a click, what each needs (app type, scopes, review,
business verification, cost), what our code already has, and a ranked recommendation.

Sources are official developer docs read on 23 Oct 2026 unless marked *secondary* or
*unverified*. Nothing was signed up for, submitted or called.

## Summary and ranking

| Rank | Platform app | Type | Merchant value (Indian D2C) | Effort | State after this PR |
|---|---|---|---|---|---|
| 1 | **Meta Business app: WhatsApp Tech Provider (Embedded Signup v4)** | Platform app, Tech Provider | Very high: COD confirmation, order updates, cart recovery | Medium (Business Verification, App Review with 2 videos) | Built: one-click signup, webhook health, deauth/deletion |
| 2 | **Same Meta app: catalog for Facebook / Instagram / WhatsApp (Login for Business, system user token)** | Platform app | High: catalog ads, Instagram/Facebook shop storefronts (checkout on our site) | Low (shares the app and verification with 1) | Built: config_id login, Graph v26, rejected-item report |
| 3 | **Google Merchant API (OAuth client + GCP registration)** | Platform OAuth client | Very high: free listings and Shopping ads | Medium (OAuth verification ~1 week, one-time `registerGcp`) | Already real; added the disapproval report |
| 4 | **Shopify "Koomerce Migration" app (public, unlisted)** | Platform app, public distribution | High: the switching lever from Shopify | Medium-high (App Store review, protected customer data Level 2, `read_all_orders` approval) | Built: OAuth install, expiring tokens, compliance webhooks, toml |
| 5 | **Meta Conversions API (same app, `ads_management`)** | Platform app | High for merchants running ads | Medium (Marketing API Full Access tier, `partner_agent` from Meta) | **Not built**: next PR (needs the Meta app first) |
| 6 | Razorpay Technology Partner OAuth | Partner app | High (no pasted keys) | Low | Exists in code (`/api/apps/razorpay/oauth/callback`), waits on Razorpay partner approval |
| 7 | Cashfree partner OAuth | Partner app | Medium | Low-medium | Per-merchant keys today |
| 8 | Amazon SP-API, Flipkart Seller API | Public developer / API partner | High but a different product (marketplace sync) | High | Not started |
| 9 | ONDC (seller app / TSP) | Network participant | Medium (policy, visibility) | High (Pramaan certification) | Not started |
| 10 | Pinterest, Snapchat | Developer apps | Low in India | Low-medium | Not started |
| - | OpenAI / ChatGPT, Google UCP, Copilot, Perplexity | Merchant programs | Low today: none live in India | - | ChatGPT feed push exists |
| - | Chrome extension | - | Not worth it now | - | Skip |

Why this order: WhatsApp is the channel Indian D2C actually runs on, and the Meta app that
carries it also carries the catalog and (next) Conversions API, so one Business Verification
and one app unlocks three things. Google is free traffic and our integration was already real;
it needed only the owner's registration and the review loop. The Shopify app turns migration
from "make a Dev Dashboard app and paste secrets" into one click, but Shopify's review and
protected-data approval take weeks, so it is built now to start that clock.

## Time-critical findings

- **WhatsApp Embedded Signup v2 and v3 were deprecated on 15 Oct 2026; build on v4.**
  https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider
- **WhatsApp India billing must be in INR by 31 Dec 2026**; from 1 Jan 2027 Meta stops delivering
  for non-INR India accounts. Service messages beyond 1,000 free per number per month are charged
  from 1 Oct 2026. https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- **Graph API v21.0 (what Sales channels used) expires 21 Jan 2027; v22.0 (WhatsApp) 20 May 2027.**
  Latest is v26.0 (29 Jul 2026). Both now pin v26.0.
  https://developers.facebook.com/docs/graph-api/changelog/versions
- **Content API for Shopping sunset 18 Aug 2026** (410s from 1 Sep 2026). We use Merchant API v1
  only. https://developers.google.com/shopping-content/guides/sunset
- **Shopify: public apps created on or after 1 Apr 2026 must use expiring offline tokens.**
  https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-public-apps-april-1-2026
- **Shopify Admin API 2025-10 is unsupported; 2026-10 is current.** The importer still asks for
  `2025-07`, which Shopify now serves as the oldest supported version (fall-forward). Bump it in
  a follow-up with a live check of the queries. https://shopify.dev/docs/api/usage/versioning
- **Google Ads developer tokens were sunset 9 Sep 2026**; access levels now belong to the GCP
  project. https://developers.google.com/google-ads/api/docs/api-policy/access-levels
- **Meta Shops in-app checkout ended in 2025**: Shops and Instagram product pages send buyers to
  the merchant's own checkout URL.
  https://developers.secure.facebook.com/documentation/ads-commerce/commerce-platform/setup-checkout-url
  (*secondary*: https://www.bigcommerce.com/blog/updates-to-meta-shops-checkout-for-bigcommerce/).
  Whether Shops / product tagging is enabled for India in 2026 is *unverified*.

## 1. Meta (Facebook, Instagram, WhatsApp)

**What to register.** One Meta app of type **Business**, owned by Koomerce's own business
portfolio (Business Verification done), using **Facebook Login for Business** with
*configurations* (`config_id`) instead of scope lists.
https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business

- Token types: user access tokens (short-lived, tied to a person) or **business integration
  system user tokens** (tied to the merchant's business portfolio, no expiry by default). Use the
  system user token for server-side sync. Web login only; `email`/`public_profile` not on BISU.
- **Permissions**:
  - Catalog: `catalog_management` (depends on `business_management`). Screencast: login, grant,
    create/update/delete a catalog.
    https://developers.facebook.com/docs/permissions/reference/catalog_management
  - WhatsApp (Tech Provider): `whatsapp_business_management`, `whatsapp_business_messaging` at
    Advanced Access. https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
  - Conversions API as a platform: `ads_management`, `ads_read`, `pages_read_engagement`,
    Marketing API "Full Access" tier (500 calls in 15 days), plus a `partner_agent` string agreed
    with Meta. https://developers.facebook.com/documentation/ads-commerce/conversions-api/set-up-conversions-api-as-a-platform
- **Catalog API**: `POST /{catalog_id}/items_batch`, up to 5,000 items per call (Meta recommends
  under 3,000; we send 1,000), poll `check_batch_request_status` for async errors.
  https://developers.facebook.com/documentation/ads-commerce/catalog/guides/manage-catalog-items/catalog-batch-api
- **Embedded Signup v4 flow**: JS SDK `FB.login` with the signup `config_id`,
  `response_type: 'code'`, `override_default_response_type: true`, `extras: { setup: {} }`;
  listen for `WA_EMBEDDED_SIGNUP` messages from `*.facebook.com` (`FINISH`, `FINISH_ONLY_WABA`,
  …, `CANCEL`, `ERROR`); exchange the 30-second code server-side; `POST /{waba}/subscribed_apps`;
  `POST /{phone_number_id}/register` with a 6-digit PIN; merchant adds a payment method.
  https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/
- **Webhooks**: GET handshake (`hub.mode=subscribe`, `hub.verify_token`, echo `hub.challenge`);
  POST signed `X-Hub-Signature-256: sha256=<hex HMAC of raw body with app secret>`. Subscribe to
  `account_update` (required for onboarding).
  https://developers.facebook.com/docs/graph-api/webhooks/getting-started
- **Review and timeline**: Business Verification first (*secondary*: 2-5 business days,
  https://www.infobip.com/docs/whatsapp/tech-provider-program/setup-and-integration); App Review
  per permission with screencasts; Tech Provider review wants two videos (a message sent from our
  app and received in WhatsApp; a template created in our app). Official turnaround *unverified*.
  Annual **Data Use Checkup**. Data deletion callback (or instructions URL) required.
- **Costs**: app and review free. WhatsApp billed per delivered message by category (marketing,
  utility, authentication) to the merchant's own WABA; service replies in the 24-hour window free
  (1,000 per number per month from 1 Oct 2026); India marketing rate rose 1 Jan 2026. CAPI free.
- **Already in our code before this PR**: Meta catalog sync over Graph v21 with a scope-based
  login and 60-day user tokens (`packages/core/src/sales-channels/`); WhatsApp messages with a
  pasted phone number id and token (`packages/notifications-whatsapp`); a client-side Meta pixel
  (`preferences.tracking.metaPixel`). No webhooks, no deletion callback, no CAPI.

## 2. Google

- **Merchant API v1** (`https://merchantapi.googleapis.com/`); v1beta discontinued 28 Feb 2026
  (*unverified in English*).
- **One-time developer registration**: `POST /accounts/v1/accounts/{ACCOUNT_ID}/developerRegistration:registerGcp`
  with `{"developerEmail": ...}`, from Koomerce's own Merchant Center account (admin). Calls from
  an unregistered project fail with 401; one Merchant Center account per project.
  https://developers.google.com/merchant/api/guides/quickstart/registration
- **Scope** `https://www.googleapis.com/auth/content`. Apps using it "must go through the OAuth
  verification review process" (unverified apps get warnings and a 100-user cap; typically 3-5
  business days, up to ~10).
  https://developers.google.com/merchant/api/guides/authorization/access-client-accounts,
  https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification.
  Sensitive vs restricted class *unverified*; no CASA expected.
- **Disapprovals**: `reports:search` on `product_view` with `aggregated_reporting_context_status`
  and `item_issues`. https://developers.google.com/merchant/api/guides/reports/quickstart
- **Google & YouTube / YouTube Shopping in India** runs as an affiliate program with big retailers;
  direct D2C connection in India *unverified*.
  https://blog.google/intl/en-in/products/platforms/helping-indian-creators-build-thriving-businesses-on-youtube-shopping/
- **UCP / agentic checkout** (AI Mode, Gemini): select US merchants only; India not listed.
  https://support.google.com/merchants/answer/16837055
- **Google Ads conversions**: access levels per GCP project (Explorer auto, Basic with brand
  verification, Standard with a ~10-day audit); Data Manager API (GA Dec 2025) is the ingestion
  API for enhanced and offline conversions.
  https://developers.google.com/data-manager/api/devguides. Not built.
- **GA4 Measurement Protocol**: no app needed (merchant's measurement id + API secret).
- **Sign in with Google**: already built for merchants (`MERCHANT_GOOGLE_*`) and shoppers
  (`SHOPPER_GOOGLE_*`); needs brand verification for logo and name on the consent screen.
- **Search Console**: already built (`GSC_GOOGLE_*`), same consent-screen verification.
- **Costs**: free.
- **Already in our code**: real OAuth (PKCE), account and data source discovery,
  `productInputs:insert`/delete, token refresh, a 6-hourly sync. Missing before this PR: the
  disapproval loop and the owner's `registerGcp` step.

## 3. Shopify (migration importer)

- **Distribution**: custom distribution is one store (or one Plus organisation): no use for many
  merchants. **Public distribution** needs App Store review even when unlisted; before approval
  the app installs only on development stores; the choice cannot be changed later.
  https://shopify.dev/docs/apps/launch/distribution, https://help.shopify.com/en/manual/apps/about-apps
- Apps are made in the **Dev Dashboard** and configured with Shopify CLI (3.84.1+).
  https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners
- **Scopes**: the importer's 15 read scopes. `read_all_orders` needs Shopify's approval
  (*secondary*: 2-4 weeks). `read_customers`/`read_orders` with names, emails, phones and
  addresses need **protected customer data Level 2**.
  https://shopify.dev/docs/apps/launch/protected-customer-data
- **OAuth**: authorization code grant; verify the callback `hmac` (sorted query, HMAC-SHA256 hex,
  client secret), `state`, and the shop regex; exchange with `expiring=1` (1-hour access token,
  90-day refresh token).
  https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
- **Mandatory compliance webhooks**: `customers/data_request`, `customers/redact`, `shop/redact`
  (48 h after uninstall); 401 on a bad `X-Shopify-Hmac-Sha256`; act within 30 days. Plus
  `app/uninstalled`. https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
- **Fees**: 0% revenue share on the first US$1M lifetime, then 15%
  (https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share); a one-time app
  submission fee (amount *unverified*).
- **Already in our code**: a complete importer (`packages/plugin-shopify-import`) connecting
  through a Dev Dashboard app the merchant makes (client credentials grant) or a legacy `shpat_`
  token. No platform app, no OAuth install, no webhooks.

## 4. Pinterest and Snapchat

- **Pinterest API v5**: developer app; Trial (sandbox) then Standard access with a demo video
  (community reports 2+ weeks); catalogs and Conversions API (`POST /ad_accounts/{id}/events`).
  https://developers.pinterest.com/docs/key-concepts/access-tiers/ Free. Low-medium value in India.
- **Snapchat**: OAuth app in Snap Business Manager (Organization Admin), scopes
  `snapchat-marketing-api`, `snapchat-offline-conversions-api`.
  https://developers.snap.com/api/marketing-api/Ads-API/authentication Self-serve ads in India
  *unverified*. Low value.

## 5. Indian marketplaces

- **Amazon SP-API (amazon.in, marketplace `A21TJRUUN4KGV`, EU region)**: register as a public
  developer in the Solution Provider Portal; restricted (PII) roles add a data-protection review.
  https://developer-docs.amazon.com/sp-api/docs/register-as-a-public-developer. A 2026 annual fee
  was announced (https://developer.amazonservices.com/spp-announcement) and reportedly withdrawn
  (*secondary*). High value, heavy effort: a marketplace-sync product of its own.
- **Flipkart Seller API**: Partner Dashboard "API Partner = Yes" (72-hour verification), a
  third-party app with an HTTPS redirect URL, sandbox before live; sellers must not share their
  self-access credentials with aggregators. https://seller.flipkart.com/api-docs/FMSAPI.html
- **Meesho**: no public supplier API; partner-gated (*secondary*).
- **ONDC**: seller app / technology service provider; signing keys, pre-production registry,
  Pramaan certification, then production (Beckn protocol). https://pramaan.ondc.org/,
  https://github.com/ONDC-Official. Fees and timeline *unverified*. Joining through an existing
  seller network partner is the easier route.
- **Myntra, Nykaa, JioMart**: no public self-serve partner API found.

## 6. AI commerce

- **OpenAI**: product feeds, Agentic Checkout and Delegated Payment specs
  (https://developers.openai.com/commerce); Instant Checkout reportedly scaled back in Mar 2026
  (*secondary*); India availability *unverified*. **Apps in ChatGPT** (Apps SDK, MCP) accept
  directory submissions: Koomerce already has an MCP server, so a merchant-facing ChatGPT app is a
  plausible later step. Our ChatGPT feed push (`openAiPushFeed`) stays as is.
- **Microsoft Copilot Checkout** (US only, via Shopify/PayPal/Stripe), **Perplexity** (US, PayPal):
  nothing for India today.

## 7. Browser extensions

Chrome Web Store: $5 one-time registration, slower reviews in 2026
(https://developer.chrome.com/blog/cws-review-updates-2026). A product scraper carries ToS and IP
risk; supplier CSV/API import and the Shopify app cover the legitimate needs. **Skip.**

## 8. Payment and courier partners

- **Razorpay**: OAuth app in the Partner Dashboard (development and production clients),
  `https://auth.razorpay.com/authorize`, `read_only`/`read_write`, ~90-day tokens.
  https://razorpay.com/docs/partners/technology-partners/onboard-businesses/integrate-oauth/integration-steps
  Our code has the callback; the owner needs the Technology Partner approval.
- **Cashfree**: software partner by contacting support, then OAuth.
  https://www.cashfree.com/docs/partners/embedded/oauth-flow
- **PayU**: partner OAuth *unverified*. **Shiprocket, Delhivery**: per-merchant API keys; no
  partner app found.

## What this PR builds (top 4) and what it leaves

Built: the shared plumbing (`platform_account` table and lookup function, signature checks,
platform webhooks on the worker, outbox events for automations), WhatsApp Embedded Signup v4,
Meta Login for Business with system user tokens and Graph v26, Meta deauthorize and data deletion
callbacks, WhatsApp account health from webhooks, Google and Meta rejected-item reports, the
Shopify migration app (toml, OAuth install with expiring tokens, compliance and uninstall
webhooks). Details: `docs/handoff/changes/2026-10-23-platform-apps.md`.

Left for later, in order: Meta Conversions API (after the Meta app has `ads_management` and Meta
gives a `partner_agent`), bump the Shopify Admin API version to 2026-10 with a live check,
Razorpay partner approval, Cashfree partner OAuth, Amazon SP-API / Flipkart as a marketplace
product, ONDC through a network partner, Pinterest catalog.
