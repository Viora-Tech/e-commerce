# Platform apps: WhatsApp Embedded Signup, Meta Login for Business, Shopify migration app

Research and ranking: `docs/research/2026-10-23-platform-apps.md`. Developer docs: "Platform
apps" (`apps/docs/content/developer-docs/building/platform-apps.mdx`). App configs to push:
`integrations/shopify/`, `integrations/meta/`, `integrations/google/`.

Open source: nothing adopted (`docs/open-source-radar.md` has no candidate for platform OAuth or
webhook plumbing; Shopify's and Meta's SDKs would replace a few dozen lines of `fetch` with a
large dependency). No new dependencies.

## What changed

- **Migration `0153_platform_accounts`**: `platform_account` (store, platform `meta` /
  `whatsapp` / `shopify`, external id, status, detail, last event; RLS) and the SECURITY DEFINER
  `stores_for_platform_account(platform, id)` (`storesForPlatformAccount` in `@commerce/db`), so
  callbacks that name only a Facebook user, a WhatsApp Business account or a shop find the store.
- **`packages/core/src/platform-apps/`**: `signatures.ts` (Meta `X-Hub-Signature-256` and
  `signed_request`, Shopify webhook HMAC and OAuth query `hmac`), `accounts.ts` (link, unlink,
  record a platform event), `whatsapp-signup.ts` (Embedded Signup v4: code exchange,
  `subscribed_apps`, number registration with a PIN), `meta-callbacks.ts` (WhatsApp webhooks to
  account health; deauthorize and data deletion forget the user's Meta access).
- **Sales channels (Meta)**: Graph API v21 → **v26.0** (`META_GRAPH_VERSION`; v21 stops 21 Jan
  2027), the WhatsApp channel package too (v22 → v26). With `META_LOGIN_CONFIG_ID`, Connect uses
  the Login for Business configuration and keeps the **system user token, which does not
  expire** (no more "access expired" every 60 days). The Facebook user is linked for Meta's
  deletion callbacks.
- **Sales channels (Google and Meta)**: after each sync, `verdicts.ts` asks what the platform
  refused (Google `reports:search` on `product_view`; Meta catalog `review_status`) and the channel
  page lists the count and a few reasons (`ChannelSync.rejected`, `rejectedItems`). Google calls
  moved to `google-merchant.ts` (providers.ts was over the size cap).
- **WhatsApp**: Apps → WhatsApp shows **Connect with Facebook** when `META_WHATSAPP_CONFIG_ID` is
  set (`whatsapp-signup-card.tsx`, `lib/facebook-sdk.ts`); the result fills the existing WhatsApp
  channel settings (encrypted) and turns the channel on. The card shows the account's status,
  number, quality, last failed message and last template update from webhooks; Disconnect.
  Procedures: `platformApps.whatsapp`, `completeWhatsapp`, `disconnectWhatsapp`.
- **Shopify migration app**: Shopify importer → Connect → **Install the Koomerce app** (when
  `SHOPIFY_APP_CLIENT_ID/SECRET` are set): `app-install.ts` (install URL, callback hmac + signed
  state, `expiring=1` exchange, refresh), connection mode `app` (refresh token rotated and saved),
  callback `/api/apps/shopify-import/oauth/callback`, `app-webhooks.ts`. Procedures:
  `shopifyImport.appInstall`, `startAppInstall`, `completeAppInstall`.
- **Worker** `apps/worker/src/platform-webhooks.ts`: `GET/POST /webhooks/platform/meta`,
  `POST /webhooks/platform/meta/deauthorize`, `POST /webhooks/platform/meta/data-deletion`,
  `POST /webhooks/platform/shopify` (401 on a bad HMAC). Admin
  `/api/platform/meta/deletion?code=` is the deletion status page.
- **Outbox events for automations** (no consumer yet): `channel.sync_failed`,
  `whatsapp.account_updated`, `meta.access_removed`, `shopify.app_uninstalled`, with
  `platform`, `externalId`, `platformStatus`, `message` on the payload.
- **Env** (admin and worker; `.env.example`, `deploy/env.production.example`,
  `deploy/docker-compose.prod.yml` pass-through, blank by default): `META_LOGIN_CONFIG_ID`,
  `META_WHATSAPP_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `SHOPIFY_APP_CLIENT_ID`,
  `SHOPIFY_APP_CLIENT_SECRET`. Everything stays off until they are set.

Mocked in tests, never called: Graph API, Merchant API, Shopify OAuth and Admin API. **Not
live-tested**: every flow needs the owner's apps below first.

## Owner checklist

You do these; the code does nothing until the env keys are set. `ADMIN` = the admin's public
origin (`ADMIN_URL`), `WORKER` = the worker's public origin (`NEXT_PUBLIC_WORKER_URL`).

### Meta (one Business app: WhatsApp, catalog, later Conversions API)

1. **Accounts**: a Meta business portfolio for the company (business.facebook.com) and a Meta
   developer account (developers.facebook.com) under it.
2. **Business Verification** of the portfolio (Security Center): legal name, address, phone,
   website on our domain, GST/registration document. Typically a few business days. Needed
   before App Review and for the Tech Provider program.
3. **Create the app**: type **Business**, owned by that portfolio. Add products: Facebook Login
   for Business, WhatsApp, Webhooks (Marketing API later for Conversions API).
4. **App settings → Basic**: app domain (`ADMIN` host), privacy policy URL, terms URL, data
   deletion: callback URL `WORKER/webhooks/platform/meta/data-deletion`, category "Business and
   pages", 1024×1024 icon.
5. **Facebook Login for Business → Settings**: Valid OAuth redirect URI
   `ADMIN/api/channels/meta/callback`; Login with the JavaScript SDK **on**; Allowed domains for
   the JavaScript SDK `ADMIN` host; Deauthorize callback `WORKER/webhooks/platform/meta/deauthorize`.
6. **Configurations**:
   - "Catalog": token type **System user**, assets Catalogs and WhatsApp accounts, permissions
     `catalog_management`, `business_management`, `whatsapp_business_management`. Copy its id.
   - "WhatsApp signup": variation **WhatsApp Embedded Signup** (v4), permissions
     `whatsapp_business_management`, `whatsapp_business_messaging`. Copy its id.
7. **WhatsApp → Configuration → Webhook**: callback `WORKER/webhooks/platform/meta`, verify
   token = a long random string you also put in `META_WEBHOOK_VERIFY_TOKEN`; subscribe
   `account_update`, `phone_number_quality_update`, `message_template_status_update`, `messages`.
8. **Env**: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `META_WHATSAPP_CONFIG_ID`,
   `META_WEBHOOK_VERIFY_TOKEN` (admin and worker). Test with your own business while the app is
   in development mode (roles: add yourself as admin/tester).
9. **App Review** (Advanced Access) for `catalog_management`, `business_management`,
   `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`. Use-case text:

   > Koomerce is an e-commerce platform for Indian brands. Merchants connect their own Meta
   > business in Koomerce (Sales channels → Facebook / Instagram, and Apps → WhatsApp). With
   > `catalog_management` and `business_management` Koomerce creates one product catalog in the
   > merchant's business and keeps it in sync with their store (create, update and delete items),
   > so their products appear in Instagram and Facebook shops and catalog ads. With
   > `whatsapp_business_management` and `whatsapp_business_messaging` merchants onboard their
   > WhatsApp number through Embedded Signup and Koomerce sends their order updates (order
   > placed, paid, shipped) using templates they approved. Koomerce only acts on assets the
   > merchant chose in the login dialog and removes access when they disconnect.

   **Screencast script** (one take each, English UI, show the URL bar):
   - Catalog: log in to the Koomerce admin as a test merchant → Sales channels → Social media →
     Instagram → Connect → the Facebook Login for Business dialog, pick the business and catalog,
     grant → back in Koomerce, status "First sync" then "Connected" → open Commerce Manager and
     show the items → edit a product price in Koomerce → Sync now → the price changes in Commerce
     Manager → archive the product → Sync now → it is deleted → Manage → Disconnect.
   - WhatsApp (Tech Provider, two videos): (1) Apps → WhatsApp → Connect with Facebook → finish
     Embedded Signup with a test number → the card shows the number and "Working" → Settings →
     Notifications → Send yourself a test of "Order placed" → show the message arriving in the
     WhatsApp app. (2) Create a message template in WhatsApp Manager for that WABA (or from
     Growth → Campaigns' template picker) and show it listed in Koomerce.
10. **Tech Provider**: in the WhatsApp product, complete the Tech Provider onboarding (accept the
    terms, it is on you to do so), after Business Verification and App Review.
11. **Data Use Checkup** once a year (Meta emails you).
12. **Conversions API (next PR)**: request `ads_management`, `ads_read`, `pages_read_engagement`
    and the Marketing API Full Access tier; ask your Meta partner contact for a `partner_agent`
    string. Nothing to do until that PR.

### Google (Merchant API)

1. **Accounts**: a Google Cloud organisation/project "Koomerce Merchant" and a Merchant Center
   account for the company itself (merchants.google.com), with our website verified.
2. **Enable Merchant API** in the project.
3. **OAuth consent screen**: External; app name, logo, support email; authorised domain = the
   admin's domain; privacy policy and terms URLs; scopes `openid`, `email`,
   `https://www.googleapis.com/auth/content`.
4. **OAuth client** (Web application): authorised redirect URI `ADMIN/api/channels/google/callback`.
   Env: `GMC_GOOGLE_CLIENT_ID`, `GMC_GOOGLE_CLIENT_SECRET` (or leave blank to share the
   `MERCHANT_GOOGLE_*` client; a separate project keeps verification separate).
5. **Register the project once** (`registerGcp`): see `integrations/google/README.md`; signed in as
   a Merchant Center admin of the company account, `developerEmail` = your Google account. Without
   it every Merchant API call answers 401.
6. **Verification**: submit the consent screen. Justification text:

   > Koomerce is an e-commerce platform. A merchant connects their own Google Merchant Center
   > account; Koomerce uses the content scope to create one product data source in it and keep
   > their store's products there in sync (insert, update, delete product inputs), and to read the
   > product status report so the merchant sees which products Google disapproved and why.

   **Demo video**: Koomerce admin → Sales channels → Social media → Google → Connect → the Google
   consent screen with the content scope → back in Koomerce, "First sync" then "Connected" → in
   Merchant Center show the data source and products → a disapproved product listed on the
   channel page with its reason. Expect about a week.

### Shopify ("Koomerce Migration" app)

1. **Accounts**: a Shopify Partner account (partners.shopify.com, free) for the company; the Dev
   Dashboard; a development store for testing.
2. **Create the app** in the Dev Dashboard: "Koomerce Migration", **public distribution**
   (unlisted is fine; this cannot be changed later).
3. **Push the config**: edit `integrations/shopify/shopify.app.toml` (`ADMIN_HOST`,
   `WORKER_HOST`), then `shopify app config link` and `shopify app deploy` from that folder
   (Shopify CLI 3.84.1+). This sets the redirect URL `ADMIN/api/apps/shopify-import/oauth/callback`,
   the scopes, the three compliance webhooks and `app/uninstalled` to
   `WORKER/webhooks/platform/shopify`.
4. **Env**: `SHOPIFY_APP_CLIENT_ID`, `SHOPIFY_APP_CLIENT_SECRET` (admin and worker).
5. **API access requests** in the Dev Dashboard: protected customer data **Level 2** (name, email,
   phone, address) and `read_all_orders`. Justification:

   > Koomerce Migration moves a merchant's own store from Shopify to Koomerce. It reads products,
   > collections, customers and orders (with names, emails, phones and addresses) once, on the
   > merchant's request, and writes them into the merchant's new Koomerce store, which they own and
   > operate. It keeps no copy of customer data outside that store, never writes to Shopify, and
   > its access ends when the merchant uninstalls it. Full order history (`read_all_orders`) lets
   > the merchant keep their past orders and customer lifetime value after moving.

6. **Test on the development store**: Shopify importer → Connect → Install the Koomerce app →
   approve → Test connection (no missing scopes) → Preview import → Import now; then uninstall the
   app in Shopify and check the Connect page shows "not connected".
7. **Submit for review** with a screencast: install from our admin on a development store,
   approve, preview, import, show products and customers in Koomerce, uninstall in Shopify and
   show the connection gone. Shopify also tests the compliance webhooks (HMAC) automatically.
8. A one-time app submission fee may apply; revenue share is 0% (the app is free).

### Not now (ranked later in the research)

Razorpay Technology Partner (callback already built; finish their partner approval), Cashfree
partner OAuth, Amazon SP-API and Flipkart (marketplace product), ONDC via a network partner,
Pinterest. No action yet.

## How to test locally (without the platforms)

Unit and DB tests mock every platform: `bun --cwd packages/core vitest run src/platform-apps
src/sales-channels`, `bun --cwd packages/plugin-shopify-import vitest run test/app-install.test.ts`,
`bun --cwd apps/worker vitest run src/platform-webhooks.test.ts`. In the admin with no new env
keys, nothing changes (no "Install the app" tab, no "Connect with Facebook"). With dummy
`SHOPIFY_APP_CLIENT_ID/SECRET`, the tab shows and Install sends you to
`https://<shop>/admin/oauth/authorize?...` (Shopify will refuse the dummy app, which is expected).
