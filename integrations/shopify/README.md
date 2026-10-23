# Koomerce Migration (Shopify app)

The platform's own Shopify app. A merchant moving from Shopify types their shop address in
**Apps → Shopify importer → Connect → Install the Koomerce app**, approves the read scopes on
Shopify, and comes back connected. Without it they make their own Dev Dashboard app or paste
a token (both still work).

Code: `packages/plugin-shopify-import/src/app-install.ts` (install URL, callback checks, the
expiring offline token and its refresh), `connection.ts` (`app` mode), `app-webhooks.ts`;
admin callback `apps/admin/src/app/api/apps/shopify-import/oauth/callback/route.ts`; worker
endpoint `POST /webhooks/platform/shopify` (`apps/worker/src/platform-webhooks.ts`).

## Build and push the config

Needs [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.84.1 or later and a Shopify
Partner (Dev Dashboard) account. Nothing here is deployed by CI.

1. In the Dev Dashboard, create an app named "Koomerce Migration" (public distribution; it
   can stay unlisted).
2. Edit `shopify.app.toml`: `ADMIN_HOST` (the admin's public host, as in `ADMIN_URL`) and
   `WORKER_HOST` (the worker's public host, as in `NEXT_PUBLIC_WORKER_URL`).
3. From this folder: `shopify app config link` (choose the app; it writes `client_id`), then
   `shopify app deploy` to release the config as a version.
4. Copy the client ID and secret from the app's settings into the deployment's environment as
   `SHOPIFY_APP_CLIENT_ID` and `SHOPIFY_APP_CLIENT_SECRET` (admin and worker).
5. Install it on a development store and run a dry-run import end to end before review.

## What Shopify checks in review

- OAuth starts from our admin and the callback verifies Shopify's `hmac` and our `state`
  (done in `checkInstallCallback`).
- Expiring offline tokens (`expiring=1`), required for public apps created from 1 April 2026.
- The three privacy webhooks answer 200 with a valid HMAC and 401 without.
- Protected customer data Level 2 justification (the importer copies customers and orders
  into the merchant's own new store) and `read_all_orders` approval for full order history.

Owner checklist with review text: `docs/handoff/changes/2026-10-23-platform-apps.md`.
