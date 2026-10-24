# Shopify app launch: straight to authorize

Shopify's automated review check "Immediately authenticates after install" failed. Shopify opens
the app URL with a signed `shop`, and our Connect page threw "Sign in required" when the merchant
was not signed in to Koomerce.

- `application_url` is now `/api/apps/shopify-import/launch`. It checks Shopify's hmac and goes
  straight to the authorize screen for that shop, with a state for no store yet (`LAUNCH_STORE`).
- Callback, signed in: `completeAppInstall` accepts a launch state for the current store.
- Callback, signed out: the code is swapped right away and sealed (`sealInstallGrant`, 30
  minutes) into an http-only cookie scoped to `/api/apps/shopify-import`. The merchant goes on to
  `/login?next=/api/apps/shopify-import/oauth/claim`. The claim route calls `claimAppInstall`
  for their store and deletes the cookie.
- After sign-in, a `next` that is an API route loads as a full page (`goAfterSignIn`).
- Push the new app URL: `shopify app deploy --config production --allow-updates` from
  `integrations/shopify`.
