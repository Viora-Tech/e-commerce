# Koomerce on Google (Merchant API)

Sales channels → Google pushes each store's catalog to the merchant's own Merchant Center
account through **Merchant API v1** (`packages/core/src/sales-channels/providers.ts`), with the
merchant's OAuth consent (scope `https://www.googleapis.com/auth/content`). The Content API for
Shopping is sunset (18 Aug 2026); nothing here uses it.

After each sync the channel page shows how many products Google did not approve and why
(`googleRejectedItems`: `reports:search` over `product_view`).

## One Google Cloud project for the platform (the owner does this)

1. Google Cloud project "Koomerce Merchant" → enable **Merchant API**.
2. OAuth consent screen: External, app name, logo, support email, the admin's domain as an
   authorised domain, privacy policy and terms URLs; scopes `openid`, `email`,
   `https://www.googleapis.com/auth/content`.
3. Credentials → OAuth client (Web application): authorised redirect URI
   `ADMIN_URL/api/channels/google/callback`. Client id and secret → `GMC_GOOGLE_CLIENT_ID`,
   `GMC_GOOGLE_CLIENT_SECRET` (admin and worker).
4. **Register the project with Merchant API once**, from the platform's own Merchant Center
   account (not a merchant's): calls from an unregistered project fail with 401. In the API
   Explorer on
   https://developers.google.com/merchant/api/reference/rest/accounts_v1/accounts.developerRegistration/registerGcp
   call `accounts/{PLATFORM_MC_ID}/developerRegistration:registerGcp` with body
   `{"developerEmail": "<the owner's Google account>"}`, signed in with a Merchant Center admin
   on that account. The project can be registered to one Merchant Center account at a time.
5. Submit the consent screen for verification (justification and demo video in the owner
   checklist). Until it is verified, merchants see the "unverified app" warning and the app is
   limited to 100 test users.

Owner checklist: `docs/handoff/changes/2026-10-23-platform-apps.md`.
