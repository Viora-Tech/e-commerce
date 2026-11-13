# Apps → WhatsApp: Setup, Messages, Templates, Settings (Figma 928:11726)

Branch `feat/whatsapp-setup`. Migration **0246_notification_channel_log** (an index only:
`notification (store_id, channel, created_at)` for the message log).

- **Pages** (`packages/notifications-whatsapp/src/plugin.ts`, `apps/admin/src/apps/registry.ts`):
  `''` Setup, `messages`, `templates`, `settings` (the old connect form), and `connect` kept
  (Settings → Notifications and the shell's fix link go there). App bar gets a
  "Connect WhatsApp" header action while the channel is not connected.
- **Setup** (`components/apps/whatsapp/setup-page.tsx`): three steps with a progress bar, read
  from what is saved: 1 number (provider `phoneNumberId`, masked display number and "verified"
  from the Embedded Signup `platform_account`), 2 Meta connection (channel validates + enabled +
  account active), 3 `order_placed`, `order_shipped`, `delivered` approved on Meta. "What
  shoppers get" fills the store's own template bodies with sample data.
- **Templates** single source: `whatsappTemplateSpec` (`notifications-whatsapp/src/template-specs.ts`)
  writes each body from the WhatsApp copy (`renderWhatsapp`) with each `templateParams` value
  swapped for its `{{n}}`; sample-only fields are dropped first, a missing shopper name becomes a
  "Hi {{1}}," greeting, other missing params a "Details:" line, and a body never starts or ends on
  a placeholder (Meta refuses that). The list of messages = `MESSAGE_CATALOGUE` WhatsApp ones +
  `login_code` (phone sign-in). Exposed to the API through the factory hook `templateSpecs`.
- **Meta API** (`notifications-whatsapp/src/templates-api.ts`): `WhatsappChannel.templateStatuses()` (GET `/{waba}/message_templates`, all pages,
  only Graph next links) and `submitTemplate()` (POST, Utility, the store's template language,
  `example.body_text`). Errors carry Meta's `error_user_title/msg`. Needs the saved
  `businessAccountId` (Embedded Signup saves it; the manual form has the field). Without it the
  page says so and shows the bodies to copy. Authentication (code) templates are never posted.
- **API** (`platformApps.*`): `whatsappSetup`, `whatsappTemplates`, `whatsappMessages`
  (settings.read), `submitWhatsappTemplates` (settings.manage). Service:
  `packages/api/src/services/whatsapp-setup.service.ts`. Tokens are decrypted only inside the
  channel; nothing logs them.
- **Messages**: the `notification` rows with `channel = 'whatsapp'` (template, to, status,
  Meta's error, order number), 50 per fetch with "Load more".

Sweeps: `file-size` schema.ts record 2687 → 2690 (one index line; dev was already at the
margin); `no-orphans` drops `decryptNotificationSettings` (now imported).

Left alone: the app shell's "Needs setup" banner still shows above the page (the frame has none);
login_code over WhatsApp sends two body params, which an Authentication template cannot take.
