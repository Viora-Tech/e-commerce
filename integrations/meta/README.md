# Koomerce on Meta (one Business app)

One Meta app, type **Business**, owned by the platform's own business portfolio, serves every
store for:

| Use | Code | Meta product / configuration |
|---|---|---|
| Facebook and Instagram catalog (Sales channels → Social media) | `packages/core/src/sales-channels/` | Facebook Login for Business configuration, system user token, `catalog_management` + `business_management` |
| WhatsApp catalog link | same | `whatsapp_business_management` |
| WhatsApp messages (Apps → WhatsApp, "Connect with Facebook") | `packages/core/src/platform-apps/whatsapp-signup.ts`, `apps/admin/src/lib/facebook-sdk.ts` | Embedded Signup v4 configuration, `whatsapp_business_management` + `whatsapp_business_messaging` (Tech Provider) |
| WhatsApp account health | `packages/core/src/platform-apps/meta-callbacks.ts` | Webhooks, object WhatsApp Business Account, fields `account_update`, `phone_number_quality_update`, `message_template_status_update`, `messages` |
| Deauthorize / data deletion | worker `apps/worker/src/platform-webhooks.ts` | Facebook Login for Business settings |

Graph API version: `META_GRAPH_VERSION` in `packages/core/src/sales-channels/providers.ts`
(v26.0; the WhatsApp channel package uses the same). Meta keeps a version two years.

## App settings to enter (the owner does this)

Replace `ADMIN` with the admin's public origin (`ADMIN_URL`) and `WORKER` with the worker's
(`NEXT_PUBLIC_WORKER_URL`).

- App settings → Basic: app domains `ADMIN` host; privacy policy URL; terms URL; category
  "Business and pages"; icon 1024×1024.
- Facebook Login for Business → Settings: Valid OAuth redirect URI
  `ADMIN/api/channels/meta/callback`; Allowed domains for the JavaScript SDK: `ADMIN` host;
  Login with the JavaScript SDK: on; Deauthorize callback URL
  `WORKER/webhooks/platform/meta/deauthorize`; Data deletion request URL
  `WORKER/webhooks/platform/meta/data-deletion`.
- Facebook Login for Business → Configurations:
  1. "Koomerce catalog": token type System user, assets Catalogs (+ WhatsApp accounts),
     permissions `catalog_management`, `business_management`, `whatsapp_business_management`.
     Its id → `META_LOGIN_CONFIG_ID`.
  2. "Koomerce WhatsApp": variation WhatsApp Embedded Signup, permissions
     `whatsapp_business_management`, `whatsapp_business_messaging`. Its id →
     `META_WHATSAPP_CONFIG_ID`.
- WhatsApp → Configuration → Webhook: callback `WORKER/webhooks/platform/meta`, verify token
  = the value of `META_WEBHOOK_VERIFY_TOKEN`; subscribe `account_update`,
  `phone_number_quality_update`, `message_template_status_update`, `messages`.

Environment (admin and worker): `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`,
`META_WHATSAPP_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`.

Review steps, screencast scripts and Business Verification:
`docs/handoff/changes/2026-10-23-platform-apps.md`.
