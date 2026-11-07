# App review submission kit (Meta, Google, Shopify)

Copy-paste sheets for registering and submitting Koomerce's own apps on Meta, Google and
Shopify. Fields are in the order each console asks for them (as of 23 Oct 2026; consoles
change, so match by label if the order moved). Background and the code behind every URL:
`docs/research/2026-10-23-platform-apps.md`, `docs/handoff/changes/2026-10-23-platform-apps.md`,
`integrations/meta/README.md`, `integrations/google/README.md`, `integrations/shopify/README.md`.

Everything marked `[OWNER: ...]` is yours to fill or confirm. Nothing here creates an account,
accepts terms or submits anything.

## Status (24 Oct 2026)

| App | State | Next |
|---|---|---|
| Shopify "Koomerce Migration" | **Paused** 3 Nov (ref 145463): 1.2.1 billing, 4.5.5 reviewer login, 3.2.1 `read_all_orders`. Version 5 (store credit scope) released 7 Nov | Fix and resubmit: see 3.7 |
| Google (project `sellverse`, named Koomerce) | Branding verified; Merchant API registered (2.4); data access **submitted** with video https://youtu.be/0G6ZNX3o4HU | Answer questions sent to vioratech907@gmail.com |
| Meta (app `2698025377367158`) | Published; **Tech Provider** (permanent); App Review draft `2698025430700486` for `catalog_management`, `business_management`, `public_profile` fully filled | Submit once business_management shows "1 of 1 API call" (1.7) |
| Meta WhatsApp (`whatsapp_business_management`, `whatsapp_business_messaging`) | Not requested yet | Separate submission with videos B and C (1.8) and a test number |

Reviewer login on every platform: `vioramice+shopifyreview@gmail.com` with **Sign in with a
password** on https://admin.koomerce.app/login (env `REVIEWER_LOGIN_EMAIL` /
`REVIEWER_LOGIN_PASSWORD`, password of 20 or more characters). Demo store: **Claw Gears**.

## 0. Before any submission

Reviewers test the live product, so these must be true first:

1. **PR #684 (platform apps) is merged and deployed** to production with its env keys set
   (`META_*`, `GMC_GOOGLE_*`, `SHOPIFY_APP_*`). The deletion status page
   `https://admin.koomerce.app/api/platform/meta/deletion` and the worker webhooks only exist
   after that.
2. **This PR is deployed on koomerce.app**: `/privacy`, `/terms`, `/data-deletion`, `/contact`
   live, with every `[OWNER: ...]` in them replaced and the "TEMPLATE" notice removed after a
   lawyer's review (`legalContent.templateNotice` in `apps/www/src/data/legal/index.ts`).
   Reviewers reject privacy policies with visible placeholders.
3. **Hosts**: this kit uses `ADMIN = https://admin.koomerce.app` and
   `WORKER = https://api.koomerce.app`, confirmed against `deploy/env.production.example`
   (`ADMIN_URL`, `NEXT_PUBLIC_WORKER_URL`, 24 Oct 2026).
4. **Support mailbox** `support@koomerce.app` receives and is answered (it is the contact on
   every console). `[OWNER: confirm the mailbox works]`
5. **Reviewer account**: one Koomerce admin login with a demo store that reviewers can use on
   all three platforms. `[OWNER: reviewer email]` / `[OWNER: reviewer password]`. Give it a
   few products with images and prices, at least one order, and the Owner role. Do not use a
   real merchant's store.
6. **Icons**: `integrations/assets/` (regenerate with `bun integrations/assets/generate-icons.ts`).

| File | Size | Use |
|---|---|---|
| `koomerce-icon-1024.png` | 1024×1024 | Meta app icon |
| `koomerce-icon-1200.png` | 1200×1200 | Shopify app icon |
| `koomerce-icon-120.png` | 120×120 | Google OAuth consent screen logo (≤1 MB, square) |
| `koomerce-icon-512.png` | 512×512 | anything else asking for a square logo |

### Common values

| Field | Value |
|---|---|
| App / brand name | Koomerce (Shopify app: Koomerce Migration) |
| Company legal name | VIORA INDIA (sole proprietorship of Kuldeep Saini; Koomerce, Waimers and Viora Tech are its brands) |
| Registered address | 745/25, Saini Niwas, Gali Number 3, Sonipat 131001, Haryana, India |
| Support email | support@koomerce.app |
| Developer contact email | `[OWNER: developer contact email, on the koomerce.app domain if possible]` |
| Phone | +91 94168 74123 |
| Website | https://koomerce.app |
| Privacy policy | https://koomerce.app/privacy |
| Terms | https://koomerce.app/terms |
| Data deletion instructions | https://koomerce.app/data-deletion |
| Support page | https://koomerce.app/contact |

---

## 1. Meta (one Business app: WhatsApp Tech Provider + catalog)

### 1.1 Business verification (do this first; it gates App Review and Tech Provider)

**Done.** Business portfolio **VIORA INDIA** (id `235952131917619`) was verified on
23 Sep 2026. The checklist below is kept for reference.

business.facebook.com → Settings → Security Center → Start verification. Have ready (scans,
PDF or JPG, names and address exactly matching what you type):

- [ ] Legal business name and registered address, exactly as on the documents.
- [ ] One **business registration** document showing the legal name, e.g. Certificate of
      Incorporation (MCA), or Partnership deed / LLP certificate, or Udyam (MSME) registration.
- [ ] **GST registration certificate** (shows legal name and address; accepted as both).
- [ ] Business **PAN** card.
- [ ] One **address proof** in the business name if the documents above lack the address:
      utility bill or bank statement (recent, usually within 3 months).
- [ ] **Business phone** that can receive an SMS or call for the code.
- [ ] **Domain verification** for koomerce.app (Business settings → Brand safety → Domains:
      DNS TXT record or HTML file) or an email on @koomerce.app for the email-code route.
      DNS is yours to add.
- [ ] Website https://koomerce.app live with the company name and the privacy policy linked in
      the footer (it is).

Accepted documents differ by country and change; follow the list Meta shows in the flow.

### 1.2 Create the app (developers.facebook.com → My Apps → Create app)

| Field | Value |
|---|---|
| Use case | "Other" → app type **Business** (or the "Connect with customers through WhatsApp" use case, which adds WhatsApp; add the rest under Products) |
| App name | Koomerce |
| App contact email | support@koomerce.app |
| Business portfolio | VIORA INDIA (id `235952131917619`, verified) |

Products to add: **Facebook Login for Business**, **WhatsApp**, **Webhooks**.

**Status (24 Oct 2026): created.** App **Koomerce**, App ID `2698025377367158`, under the
VIORA INDIA portfolio. Use cases chosen at creation include WhatsApp, Catalog API, Marketing
API (create and measure ads), Messenger, Instagram messaging and content, Pages and others.
App settings → Basic (1.3) and Facebook Login for Business → Settings (1.4) are saved, the
data deletion callback is set, the Website platform is added and the app is published.

### 1.3 App settings → Basic

| Field | Value |
|---|---|
| Display name | Koomerce |
| App domains | admin.koomerce.app, koomerce.app |
| Contact email | support@koomerce.app |
| Privacy policy URL | https://koomerce.app/privacy |
| Terms of Service URL | https://koomerce.app/terms |
| User data deletion | **Data deletion callback URL**: `https://api.koomerce.app/webhooks/platform/meta/data-deletion` (the instructions URL https://koomerce.app/data-deletion is the fallback if the form asks for one) |
| App icon | `integrations/assets/koomerce-icon-1024.png` |
| Category | Business and pages |
| Business use (if asked) | **Provide services to other businesses** (not "Support my own business") |
| Add platform → Website | Site URL `https://admin.koomerce.app/` |

The data deletion callback answers Meta with
`{ "url": "https://admin.koomerce.app/api/platform/meta/deletion?code=<code>", "confirmation_code": "<code>" }`;
the status page shows "completed" for any code we signed (`packages/core/src/platform-apps/meta-callbacks.ts`).

### 1.4 Facebook Login for Business → Settings

| Field | Value |
|---|---|
| Client OAuth login | Yes |
| Web OAuth login | Yes |
| Enforce HTTPS | Yes |
| Use Strict Mode for redirect URIs | Yes |
| Valid OAuth Redirect URIs | `https://admin.koomerce.app/api/channels/meta/callback` |
| Login with the JavaScript SDK | Yes |
| Allowed Domains for the JavaScript SDK | `https://admin.koomerce.app` |
| Deauthorize callback URL | `https://api.koomerce.app/webhooks/platform/meta/deauthorize` |
| Data Deletion Request URL | `https://api.koomerce.app/webhooks/platform/meta/data-deletion` |

### 1.5 Facebook Login for Business → Configurations

| Configuration | Variation / token | Assets | Permissions | Env |
|---|---|---|---|---|
| Koomerce catalog | General, **System-user access token** (never expires) | Catalogs, WhatsApp accounts | `catalog_management`, `business_management`, `whatsapp_business_management` | id → `META_LOGIN_CONFIG_ID` |
| Koomerce WhatsApp | **WhatsApp Embedded Signup** (v4) | WhatsApp accounts | `whatsapp_business_management`, `whatsapp_business_messaging` | id → `META_WHATSAPP_CONFIG_ID` |

### 1.6 Webhooks (WhatsApp → Configuration)

| Field | Value |
|---|---|
| Callback URL | `https://api.koomerce.app/webhooks/platform/meta` |
| Verify token | a long random string; the same value goes in env **`META_WEBHOOK_VERIFY_TOKEN`** (admin and worker) |
| Fields to subscribe | `account_update`, `phone_number_quality_update`, `message_template_status_update`, `messages` |

Signature check: `X-Hub-Signature-256` with `META_APP_SECRET`. Other env: `META_APP_ID`,
`META_APP_SECRET`.

### 1.7 App Review → Permissions and features (Advanced Access)

**Tech Provider first.** "Add to App Review" on any permission asks the app to become a Tech
Provider (permanent; needs the verified business from 1.1). Done on 24 Oct 2026. Becoming one
adds about 19 permissions to the App Review request on its own (ads, pages, Threads, leads,
Instagram…): remove every one you are not submitting now (App Review → the request → trash
icon → "Yes, remove"; it only drops them from the request, not from the app).

**Required API call.** `business_management` needs at least one counted API call before its
form saves ("0 of 1 API call(s) required"; counts take about an hour, up to 24 h). Make one in
Graph API Explorer: app **Koomerce** → Get User Access Token with `business_management` →
`GET me/businesses`.

**Platform.** Reviewer instructions stay locked until App settings → Basic → Add platform →
Website (`https://admin.koomerce.app/`) is saved; its testing instructions are what the
review form shows.

These are exactly what the code asks for (`META_SCOPES` in
`packages/core/src/sales-channels/providers.ts` and the two configurations above). Do **not**
request `pages_show_list`, `pages_read_engagement`, `instagram_*` or `ads_*`: the code does not
use them, and requesting unused permissions is a common rejection reason. (`ads_management`,
`ads_read`, `pages_read_engagement` come later with the Conversions API PR.)

"How will your app use this permission?" text, one per permission:

**`catalog_management`**

> Koomerce is an e-commerce platform for Indian brands. A merchant connects their own Meta
> business from the Koomerce admin (Sales channels → Social media → Meta → Connect Facebook). Koomerce uses catalog_management to create one product catalog in the business the
> merchant selected in the Facebook Login for Business dialog, then keep it in sync with the
> merchant's Koomerce store: it creates items for new products, updates titles, prices,
> availability and images when they change, and deletes items when a product is archived. It
> also reads each item's review status so the merchant sees in Koomerce which products Meta
> rejected and why. This lets the merchant use their own products in Facebook and Instagram
> catalog ads without uploading spreadsheets (Shops are not available in India). Koomerce only touches catalogs the
> merchant granted, and stops when they disconnect.

**`business_management`**

> catalog_management requires business_management. Koomerce uses it to read the business
> portfolio the merchant selected in the Facebook Login for Business dialog and the catalogs
> and WhatsApp Business accounts they granted inside it, so the right catalog is created and
> synced in that business and the system user token is issued for it. Koomerce does not change
> business settings, people, ad accounts or pages.

**`whatsapp_business_management`**

> Koomerce is a Tech Provider: merchants onboard their own WhatsApp Business number through
> Embedded Signup from the Koomerce admin (Apps → WhatsApp → Connect with Facebook). Koomerce
> uses whatsapp_business_management to subscribe our app to the merchant's WhatsApp Business
> account, register their phone number, read the number's status and quality rating, and read
> the merchant's message templates and their approval status, so the merchant picks approved
> templates for order updates and sees account health (restricted, quality changes, template
> rejections) on the WhatsApp page in Koomerce. It is also used to link the merchant's catalog
> to their WhatsApp account.

**`whatsapp_business_messaging`**

> Koomerce sends WhatsApp messages on behalf of the merchant from their own number: order
> updates to their customers (order placed, payment received, shipped, delivered, COD
> confirmation) using templates the merchant approved, and replies within the 24-hour customer
> service window. Messages go only to customers who placed an order or contacted the merchant,
> and are billed by Meta to the merchant's own WhatsApp Business account.

**`public_profile`** (granted by default; only if the form lists it)

> Used only to identify the Facebook user who connected their business, so a disconnect,
> deauthorization or data deletion request from Meta removes that user's connections.

**Reviewer instructions** ("Provide step-by-step instructions" box):

> 1. Go to https://admin.koomerce.app/login, click "Sign in with a password" and use the
>    reviewer login (see Status). This is the demo store "Claw Gears" with test products.
> 2. Catalog (catalog_management, business_management): left menu → Sales channels → Social
>    media → Meta → Facebook tab → Connect Facebook. In the Facebook dialog choose your test business
>    and a catalog and continue. Back in Koomerce the channel shows "First sync", then
>    "Connected" with the product count. Open Commerce Manager to see the items. Change a
>    product's price in Products, return to the channel and press "Sync now"; the price updates
>    in Commerce Manager. Archive the product and "Sync now"; it is deleted from the catalog.
>    "Manage → Disconnect" removes access.
> 3. WhatsApp (whatsapp_business_management, whatsapp_business_messaging): left menu → Apps →
>    WhatsApp → Connect with Facebook. Finish Embedded Signup with a test number. The card shows
>    the number, its status and quality. Settings → Notifications → "Send a test" for "Order
>    placed" sends a template message to the number you enter.
> Test business / number: [OWNER: Meta test business and WhatsApp test number reviewers may use,
> or "use your own test assets"].

### 1.8 Screencasts (one per permission group; 2-3 min; English UI; screen only, no talking needed)

Record at 1080p, show the browser address bar, start signed out, add on-screen captions naming
the permission at the moment it is used. Upload as MP4.

**Video A: `catalog_management` + `business_management` (~3 min)**: **done**,
`koomerce-meta-catalog-review.mp4` (2:36, captioned; uploaded to both permissions). Recorded
in the browser with the catalog `Claw Gears (Koomerce)`. A store picks its catalog by name,
`<Store name> (Koomerce)`, so create and name it in Commerce Manager before connecting.

| Time | On screen |
|---|---|
| 0:00 | koomerce.app → Sign in → admin.koomerce.app with the reviewer account. Caption: "Merchant signs in to Koomerce". |
| 0:15 | Products list: show 3-4 products with prices. |
| 0:30 | Sales channels → Social media → Meta → Facebook → Connect Facebook. |
| 0:40 | Facebook Login for Business dialog: show the permission list (catalog_management, business_management), choose the business and catalog, Continue. Caption: "business_management: merchant picks their business". |
| 1:00 | Back in Koomerce: "First sync" → "Connected", item count. |
| 1:15 | New tab: Commerce Manager → the catalog → items match the store. Caption: "catalog_management: items created". |
| 1:40 | Koomerce: edit one product's price → Social media → Meta → Manage → Sync now. Commerce Manager: price updated. Caption: "items updated". |
| 2:10 | Archive the product → Sync now → Commerce Manager: item gone. Caption: "items deleted". |
| 2:30 | If any item is rejected, show the "not approved" list on the channel page. Caption: "review status read". |
| 2:45 | Manage → Disconnect → status "Not connected". |

**Video B: Tech Provider 1, `whatsapp_business_messaging` (~2.5 min)** (Meta asks for a
message sent from the app and received in WhatsApp)

| Time | On screen |
|---|---|
| 0:00 | Signed in to the admin. Apps → WhatsApp. |
| 0:10 | Connect with Facebook → Embedded Signup popup: choose/create business, WhatsApp Business account, add and verify the test number, accept. Caption: "Embedded Signup v4". |
| 1:00 | Card shows the number, "Working", quality rating. |
| 1:15 | Settings → Notifications → "Order placed" → Send a test to the reviewer's phone. |
| 1:35 | Phone (screen mirror or second camera): the WhatsApp message arrives from the merchant's number. Caption: "whatsapp_business_messaging". |
| 2:00 | Optional: place a test order on the demo storefront and show the order-placed message arriving. |

**Video C: Tech Provider 2, `whatsapp_business_management` (~2 min)** (Meta asks for a
template created)

| Time | On screen |
|---|---|
| 0:00 | Signed in, Apps → WhatsApp card: number, status, quality (read via the API). Caption: "whatsapp_business_management: account and number status". |
| 0:20 | Create a message template for this WhatsApp Business account (WhatsApp Manager, or Growth → Campaigns template picker if it creates one) and submit it. `[OWNER: confirm which path the deployed admin supports before recording; show the one that exists]` |
| 1:00 | Back in Koomerce: the template is listed with its status; when Meta approves or rejects it the card's "last template update" changes (webhook `message_template_status_update`). |
| 1:30 | Apps → WhatsApp → Disconnect. |

### 1.9 After approval

- WhatsApp product → Tech Provider onboarding: review and accept the terms yourself.
- India: WhatsApp billing for India accounts must be in INR by 31 Dec 2026.
- Data Use Checkup once a year (Meta emails the app admins).
- Switch the app to **Live** mode.

---

## 2. Google (Cloud project OAuth + Merchant API)

Use a separate project so this verification does not hold up sign-in (`MERCHANT_GOOGLE_*`).

### 2.1 Project and API

1. console.cloud.google.com → New project: **Koomerce Merchant** (organisation:
   `[OWNER: Google Cloud organisation, or "No organisation"]`).
2. APIs & Services → Library → enable **Merchant API**.

### 2.2 Domain verification (Search Console), needed before verification

1. search.google.com/search-console → Add property → **Domain** → `koomerce.app`.
2. Copy the TXT record Google shows, add it at the DNS provider for koomerce.app (yours to do),
   wait, press Verify.
3. The Google account that will submit the OAuth verification must be an **Owner** of that
   property (Settings → Users and permissions). Same for `admin.koomerce.app` if Google asks
   for it separately (the Domain property covers subdomains).

### 2.3 Google Auth Platform (OAuth consent screen), in the order the console asks

**Branding**

| Field | Value |
|---|---|
| App name | Koomerce |
| User support email | support@koomerce.app (must be a Google account or group you manage: `[OWNER: confirm]`) |
| App logo | `integrations/assets/koomerce-icon-120.png` (logo upload starts brand verification) |
| Application home page | https://koomerce.app |
| Application privacy policy link | https://koomerce.app/privacy |
| Application terms of service link | https://koomerce.app/terms |
| Authorised domains | `koomerce.app` |
| Developer contact email | `[OWNER: developer contact email]` |

**Audience**: User type **External**. While "Testing", add test users
(`[OWNER: your Google account and the reviewer's]`); max 100.

**Data access → Add scopes**: `openid`, `.../auth/userinfo.email` (shown as `email`),
`https://www.googleapis.com/auth/content` (the code asks for exactly these three,
`packages/core/src/sales-channels/google-merchant.ts`).

**Clients → Create client** (Web application):

| Field | Value |
|---|---|
| Name | Koomerce admin (Merchant Center) |
| Authorised JavaScript origins | `https://admin.koomerce.app` |
| Authorised redirect URIs | `https://admin.koomerce.app/api/channels/google/callback` |

Client id/secret → env `GMC_GOOGLE_CLIENT_ID`, `GMC_GOOGLE_CLIENT_SECRET` (admin and worker).

### 2.4 One-time Merchant API registration

**Done on 24 Oct 2026** for Merchant Center **5882694222** (VIORA INDIA, homepage
`waimers.in`, verified). Response: `gcpIds: ["98854989778"]`. Keep that homepage; do not
switch it to koomerce.app (it runs Waimers' listings). Without the registration every Merchant
API call fails with "GCP project … not registered".

How it was done, and what failed first:

1. OAuth Playground (developers.google.com/oauthplayground) → gear → **Use your own OAuth
   credentials** → our client id and secret (the Playground URL is an authorised redirect URI
   on the client). Scope `https://www.googleapis.com/auth/content` → Authorize → Exchange.
2. Step 3: method **POST** (GET answers an HTML 404), URL with **no leading space** (a space
   gives "Invalid request URL: https://%20https://…"):
   `https://merchantapi.googleapis.com/accounts/v1/accounts/5882694222/developerRegistration:registerGcp`,
   body `{"developerEmail":"<the Google account that signed in>"}`.
3. `FAILED_PRECONDITION … unverified homepage`: verify the Merchant Center website first.
4. Connect then failed with "registered but it should have at least one user with
   API_DEVELOPER role": Merchant Center → Settings → People and access → give a verified user
   the **API developer** role.
5. "No Google Merchant Center account found" on Connect means the Google account chosen at
   sign-in is not a user of any Merchant Center: pick one listed in People and access.

### 2.5 Verification Center → Submit for verification

**Submitted on 24 Oct 2026** (video https://youtu.be/0G6ZNX3o4HU, justification below).
Before recording, remove Koomerce at myaccount.google.com/connections so the consent screen
lists the scope instead of "Koomerce already has some access", and zoom the address bar so
`client_id=` is readable.

**Scope justification** for `https://www.googleapis.com/auth/content`:

> Koomerce is an e-commerce platform that Indian brands use to run their online store. A
> merchant connects their own Google Merchant Center account from the Koomerce admin (Sales
> channels → Google → Connect). Koomerce uses the content scope, through Merchant API, to
> (1) create one product data source in the merchant's Merchant Center account, (2) insert,
> update and delete the merchant's own products in it whenever they change in their store, so
> the products show in free listings and Shopping ads, and (3) read the product status report
> so the merchant sees in Koomerce which products Google disapproved and why. No narrower scope
> gives write access to products in Merchant Center. Koomerce does not use the data for any
> other purpose, does not sell it or use it for advertising, and deletes the tokens when the
> merchant disconnects.

**`openid` / `email`**: non-sensitive; if asked: "To show the merchant which Google account is
connected to their store."

**How the app uses the data / Limited Use**: point to the "Data from Google" section of
https://koomerce.app/privacy, which contains the Limited Use disclosure.

**Demo video** (YouTube, unlisted, English, 2-3 min; Google requires the OAuth consent screen
with the **app name and the client ID visible in the address bar**):

| Time | On screen |
|---|---|
| 0:00 | koomerce.app home (shows what the app is) → Privacy policy link in footer. |
| 0:15 | Sign in to admin.koomerce.app with the reviewer account. |
| 0:25 | Sales channels → Social media → Google → Connect. |
| 0:35 | Google account chooser → consent screen. Pause; zoom the address bar so `client_id=...` is readable; show the scope "See, edit, create and delete your Google Merchant Center data" (the content scope). Continue. |
| 1:00 | Back in Koomerce: "First sync" → "Connected". |
| 1:15 | Merchant Center: Products → the Koomerce data source and its products. Caption: "insert products". |
| 1:40 | Edit a product price in Koomerce → Sync now → updated in Merchant Center. Archive one → removed. |
| 2:10 | Channel page: the "not approved by Google" list with reasons (product status report). |
| 2:30 | Manage → Disconnect. |

Expect questions by email to the developer contact; reply in the same thread. Typical time
for a sensitive scope: a few business days to about two weeks.

---

## 3. Shopify ("Koomerce Migration", public distribution)

### 3.1 Risk to read first

Shopify reviews every public app against its App Store requirements, and an app whose main
purpose is moving merchants **off** Shopify may not be accepted for public distribution.
`[OWNER: read the current App Store requirements (shopify.dev/docs/apps/launch/app-requirements-checklist)
and decide before paying any submission fee]`. If Shopify will not list it, merchants can
still connect with their own Dev Dashboard app or a token (both already work); this app only
saves them that step.

### 3.2 Create the app (dev.shopify.com → Apps → Create app)

Create it in the **Waimers Partner account** (business-owned), with the business name in the
Partner account set to **Viora India**.

| Field | Value |
|---|---|
| App name | Koomerce Migration |
| Distribution | **Public** (choice is permanent; may be unlisted) |
| App URL (`application_url`) | `https://admin.koomerce.app/apps/shopify-import/connect` |
| Embedded | No |
| Redirect URL | `https://admin.koomerce.app/api/apps/shopify-import/oauth/callback` |
| Scopes | `read_products, read_inventory, read_customers, read_orders, read_all_orders, read_content, read_online_store_navigation, read_files, read_metaobject_definitions, read_metaobjects, read_discounts, read_gift_cards, read_shipping, read_legal_policies, read_purchase_options, read_markets, read_inventory_purchase_orders, read_inventory_transfers, read_reports, read_store_credit_accounts` |
| Compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) | `https://api.koomerce.app/webhooks/platform/shopify` |
| `app/uninstalled` webhook | `https://api.koomerce.app/webhooks/platform/shopify` |
| Webhook API version | 2026-10 |

All of this is in `integrations/shopify/shopify.app.toml`: replace `ADMIN_HOST` with
`admin.koomerce.app` and `WORKER_HOST` with `api.koomerce.app`, then `shopify app config link`
and `shopify app deploy` from that folder. Client id/secret → `SHOPIFY_APP_CLIENT_ID`,
`SHOPIFY_APP_CLIENT_SECRET` (admin and worker).

### 3.3 API access requests

**`read_all_orders`** (orders older than 60 days):

> Koomerce Migration copies a merchant's store from Shopify into their new Koomerce store at
> the merchant's request. Merchants need their full order history after moving: for customer
> lifetime value, repeat-customer segments, returns and GST records of past orders. Without
> read_all_orders only the last 60 days would move and the merchant would lose most of their
> history. Orders are read once (and again only if the merchant re-runs the import), written
> into the merchant's own Koomerce store, and never written back to Shopify.

**Protected customer data → Level 1** ("Why do you need this data?"): select **"Store
management"** / migration of the merchant's own data (`[OWNER: pick the nearest option the
form offers]`), with:

> The app imports the merchant's own customers and orders into the store they are moving to,
> so their customers, order history and customer accounts continue there. The data is copied
> into a store the merchant owns and controls; the app keeps no other copy, does not use it
> for any other purpose, and never shares or sells it.

**Level 2 fields** (Name, Email, Phone, Address), same reason per field:

> Name, email, phone and address are part of each customer and order record the merchant is
> moving: they are needed to ship orders, contact customers and keep customer accounts in the
> merchant's new store.

**Data protection questions**, answered from what the code does today (`[OWNER: confirm each
before ticking; tick only what is true]`):

| Requirement | Answer |
|---|---|
| Process the minimum personal data needed | Yes: read-only scopes, copied only into the merchant's own store. |
| Tell merchants what data you process and why | Yes: https://koomerce.app/privacy (Data from Shopify). |
| Limit use to that purpose | Yes. |
| Respect and apply consent decisions | Yes: customer marketing consent fields are imported as they are in Shopify. `[OWNER: verify the importer keeps accepts-marketing flags]` |
| Customers can opt out of data sale | We do not sell data. |
| Automated decision-making with legal effect | No. |
| Retention periods | Shopify access token deleted on uninstall or `shop/redact`; imported data belongs to the merchant's store and follows Koomerce's account retention (kept while the account is active and 90 days after closure, then deleted or anonymised; backups roll off within 30 days). |
| Encrypt data at rest and in transit | Tokens encrypted (AES via `encryptSecret`); HTTPS everywhere; database encryption at rest: `[OWNER: confirm your host's disk encryption]`. |
| Encrypt backups | Yes, `BACKUP_ENCRYPTION_KEY`. `[OWNER: confirm backups run encrypted in production]` |
| Separate test and production data | Yes (separate test server). |
| Data loss prevention strategy | `[OWNER: describe backups and restore tests]` |
| Limit staff access | `[OWNER: who has production database access]` |
| Strong password requirements for staff | `[OWNER: confirm]` |
| Log access to personal data | `[OWNER: confirm what is logged]` |
| Security incident response policy | `[OWNER: write or link it]` |

### 3.4 App Store listing (needed for review even when unlisted)

Shopify shows a character counter on each field; the copy below is written short. Do not add
numbers, ratings or customer names you cannot prove.

| Field | Copy |
|---|---|
| App name | Koomerce Migration |
| App icon | `integrations/assets/koomerce-icon-1200.png` |
| Category | `[OWNER: pick the nearest, e.g. Store management → Store data importers/exporters]` |
| Languages | English |
| Tagline / subtitle | Copy your Shopify store to Koomerce in one go |
| Introduction | Move your products, customers and orders from Shopify to your Koomerce store without spreadsheets. |
| Details | Koomerce Migration reads your Shopify store and copies it into your Koomerce store: products with variants, images and inventory, collections, pages, blog posts, navigation, discounts, gift cards, customers and order history. Install it from the Koomerce admin, preview what will be imported, then import. It only reads from Shopify and never changes your Shopify store. Uninstall it any time and its access ends straight away. |
| Feature 1 | Preview before you import: see counts and samples first |
| Feature 2 | Products, customers and full order history move together |
| Feature 3 | Read-only: your Shopify store is never changed |
| Pricing | Free |
| Privacy policy | https://koomerce.app/privacy |
| Support email | support@koomerce.app |
| Support / FAQ URL | https://koomerce.app/contact |
| Developer website | https://koomerce.app |
| Demo store URL | `[OWNER: development store URL, if the form asks]` |

**Screenshots to capture** (1600×900 desktop, no browser chrome, no personal data, demo store
only):

1. Koomerce admin → Apps → Shopify importer → Connect → "Install the Koomerce app" tab with
   a shop domain typed in.
2. Shopify's install/permission screen for Koomerce Migration (development store).
3. Back in Koomerce: connected, "Test connection" passing.
4. Preview import: the counts of products, customers and orders.
5. Import in progress / finished summary.
6. Koomerce Products list after import, showing the imported products.

Feature image (if asked): 1600×900, the icon on #151515 with "Koomerce Migration".

### 3.5 Testing instructions for the reviewer

> 1. Install from our admin (installs from the App Store listing redirect to the same page):
>    sign in at https://admin.koomerce.app with [OWNER: reviewer email] / [OWNER: reviewer
>    password].
> 2. Apps → Shopify importer → Connect → "Install the Koomerce app", type your development
>    store's .myshopify.com address, press Install.
> 3. Approve the permissions on Shopify; you return to Koomerce, connected.
> 4. Press "Test connection" (no missing scopes), then "Preview import", then "Import now".
> 5. Open Products and Customers in Koomerce to see the imported records.
> 6. Uninstall the app in your Shopify admin; the Connect page in Koomerce shows "not
>    connected". The app has no screens inside Shopify admin (not embedded) and never writes
>    to Shopify.

### 3.7 Resubmission after the 3 Nov pause (ref 145463)

Shopify paused the review; it does not restart on its own. Before resubmitting:

1. **IP allowlist** (required for public apps; bulk operations fail from 12 Nov 2026, delisting
   from 20 Nov): Dev Dashboard → Koomerce Migration → Settings → IP allowlist → Manage → add the
   production server `13.232.151.16` (AWS Lightsail Mumbai; must be a static IP) (the admin and worker call the Admin API from it) → Run
   test → Enforcement on → Save. Re-add if the server changes.
2. **4.5.5 reviewer login**: fixed in #1260 (deployed with release `029ab5e4e`). Typing the
   reviewer email opens the password step; no code is sent. Check it on
   https://admin.koomerce.app/login before resubmitting.
3. **1.2.1 billing**: the app is free (listing Pricing: Free) and charges nothing through
   Shopify or elsewhere. Reply text below.
4. **3.2.1 `read_all_orders`**: keep it; moving the whole order history is the app's purpose.
   Show an order older than 60 days arriving in Koomerce in the screencast (3.6).
5. Resubmit from the Partner Dashboard with the reply below in the reviewer notes.

Reply to the reviewer:

> Thank you for the review. Koomerce Migration is free: it has no plans, charges or usage
> fees, and nothing is billed for it through Shopify or anywhere else. The Billing page you
> reached is Koomerce's own subscription for the merchant's separate Koomerce store; it is not
> part of this app and is not needed to use it (the reviewer store is already set up). The
> importer itself is Apps → Shopify importer.
>
> Sign-in: on https://admin.koomerce.app/login type the reviewer email and press Continue; the
> password field opens (no verification code). The "Sign in with a password" link does the same.
>
> read_all_orders: the app copies the merchant's complete order history into their Koomerce
> store, so customers keep their past orders and the merchant keeps their sales records and
> GST history. Without it Shopify shares only the last 60 days. The screencast shows an order
> older than 60 days being imported.

### 3.6 Screencast (~2.5 min; English; development store)

| Time | On screen |
|---|---|
| 0:00 | Shopify development store admin: products and customers to be moved. |
| 0:15 | Koomerce admin (reviewer account) → Apps → Shopify importer → Connect → Install the Koomerce app → enter shop domain → Install. |
| 0:35 | Shopify OAuth screen listing the read scopes → Install. |
| 0:50 | Back in Koomerce: connected → Test connection. |
| 1:05 | Preview import (counts) → Import now → progress → done. |
| 1:40 | Koomerce Products, Customers, Orders: imported records. |
| 2:05 | Shopify admin → Settings → Apps → Koomerce Migration → Uninstall. |
| 2:20 | Koomerce Connect page: not connected. |

Shopify also runs automated checks: the three compliance webhooks must answer 200 with a valid
`X-Shopify-Hmac-Sha256` and 401 without (they do, `apps/worker/src/platform-webhooks.ts`), and
install must start OAuth immediately.

---

## 4. Placeholder index

Website pages (apps/www/src/data/legal): company legal name, registered office address,
sub-processor list, retention period after closure, backup retention, grievance officer name,
email and postal address, grievance resolution time, policy effective date, deletion
turnaround, terms liability clause and jurisdiction city. This file adds: production hosts,
support mailbox, reviewer login, developer contact email, business phone, Meta test assets,
template path for video C, Google organisation and test users, company Merchant Center id,
Shopify category and data-protection answers, and the App Store requirements decision (3.1).
