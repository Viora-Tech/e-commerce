# Chatwoot support inbox app

Branch `feat/app-chatwoot`. A `connection` app (`packages/plugin-chatwoot`, id `chatwoot`,
category `messages`). Chatwoot is MIT outside `enterprise/` (LICENSE read 2026-10-20); it runs
separately (Cloud or self-hosted) and we only use its website SDK and Application API. Nothing
copied, nothing from `enterprise/`. Credited in the manifest and `THIRD_PARTY_NOTICES.md`; radar
row now "In use".

- **Settings** (`store.apps.settings.chatwoot`, no migration): address, account id, website inbox
  token, API access token and HMAC identity secret (both `encryptSecret`, never returned),
  `consent` (`necessary` default | `analytics` | `marketing`), `identifyShoppers`, `syncContacts`.
- **Admin**: Apps → Chatwoot (`components/apps/chatwoot/settings-page.tsx`): status, Open
  Chatwoot, read-only Test connection (profile + inboxes, checks the website token). A
  Conversations card on the order page (`orderDetailCard`) and, new, on the customer page
  (`admin.customerDetailCard` in the manifest, `ADMIN_APPS[id].CustomerCard`).
- **Storefront**: `ConsentManager` renders `ChatwootWidget` (SDK from `<chatwoot>/packs/js/sdk.js`,
  nonce, `lazyOnload`) after the chosen consent category; works on block and imported Liquid
  themes (both layouts draw ConsentManager); never in theme preview or on sign-in pages.
  Signed-in shoppers get `setUser` with `identifier_hash` (HMAC-SHA256 of the customer id) and
  custom attributes `customer_since`, `orders_count`, `total_spent` (rupees), `last_order`,
  `last_order_at`; `reset()` after sign-out.
- **Core, new events**: outbox `customer.created` / `customer.updated` (payload `customerId`)
  written by `recordCustomerChange` on sign-up (email code, magic link, OTP, provider sign-in),
  checkout, account profile and admin customer edit. They fan out as app events of the same
  names (`AppEventPayload.customerId`, `orderId` empty), one job per outbox row (`AppEventJob.key`).
  No notification. Bulk imports write none.
- **Sync**: hooks on `customer.*` and `order.paid` upsert the contact: search by identifier
  (customer id) → email → phone, create, or update only when changed; claims a guest contact
  with the same email, never one tied to another identifier; a 422 retries without email/phone;
  429/5xx throw for the worker's backoff.
- **Env**: `CHATWOOT_TRUSTED_ORIGINS` (optional; self-hosted Chatwoot on a private network/http),
  added to `deploy/docker-compose.prod.yml` and `deploy/env.production.example`.
- **Tests** (run, pass): `packages/plugin-chatwoot/test/*` (37, mocked fetch), storefront
  `consent-manager.test.ts` (chat gating), `packages/plugins` tests. Added a job-id case in
  `packages/core/src/plugins/job-ids.test.ts` (core's suite needs the DB; not run here).
  Typecheck clean: plugins, plugin-chatwoot, core, api, admin, storefront, worker.
- **Not done**: no backfill of existing customers (they sync on their next change or payment);
  no live Chatwoot run, so API shapes follow Chatwoot's docs and source.
- Docs: merchant guide Apps → Chatwoot; developer docs Plugins (Chatwoot paragraph, customer
  events, `customerDetailCard`).
