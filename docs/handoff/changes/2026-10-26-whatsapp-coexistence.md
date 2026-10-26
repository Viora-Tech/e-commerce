# WhatsApp: connect a number that already runs the WhatsApp Business app

- Apps → WhatsApp → "Connect in one step" has a second button, **I use the WhatsApp Business
  app**. It opens Embedded Signup with `featureType: 'whatsapp_business_app_onboarding'`
  (`runEmbeddedSignup({ businessApp: true })` in `apps/admin/src/lib/facebook-sdk.ts`), Meta's
  coexistence flow: the shopper chats stay in the phone app and the API sends from the same number.
  The finish event `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` was already handled.
- Works only once the Meta app has the WhatsApp permissions approved (app review) and the
  Embedded Signup configuration (`META_WHATSAPP_CONFIG_ID`) allows it.
- Copy in English and Hindi; merchant guide Settings → Notifications updated.
