# Settings → Customer privacy and Settings → Customer accounts

**Settings → Customer privacy and Settings → Customer accounts** (27 September 2026,
`feat/customer-privacy-accounts`, stacked on #206, migration `0075_customer_privacy`: tables
`cookie_consent`, `marketing_consent_event`, `data_request`, `privacy_audit_event` (append
only by trigger), `customer_otp`; `customer.accepts_sms`, `customer.anonymised_at`). Cookie
banner always gates optional tags (no more "banner off" bypass) and now also our own visit
beacon; the proxy mints `wc_vid` and `/api/beacon` records only with analytics consent;
choices are recorded with the banner version, "Ask everyone again" bumps it; footer
"Cookie settings" reopens it. Marketing consent per channel (email, WhatsApp, SMS) with
history via `setMarketingConsent`; `sendMarketingEmail`/`sendMarketingWhatsapp` refuse any
send without consent (`no_consent`), except the COD confirmation (`transactional`);
automations' `audience: 'all'` no longer widens anything. Data requests queue
(`/settings/customer-privacy/requests`) with due dates, JSON/CSV export and
`anonymiseCustomer` (keeps GST invoice data for eight years). Sign-in by email, SMS or
WhatsApp code per `store.preferences.customerAccounts`, limited to what the store's channels
can send (`NotificationChannel.medium`, new dev `log-sms` channel); guest checkout or
account required; shoppers delete their own account from `/account/privacy` with a code
(opens a deletion request, signs out everywhere). Also fixed: Online Store → Preferences
saved over the whole `store.preferences` column, wiping policies/checkout settings; it now
merges. Developer docs: `developer-docs/building/customer-privacy`; merchant guide: Settings,
Customer privacy (DPDP checklist) and Customer accounts. **Open**: no real SMS provider app
yet (only the dev log channel); no checkout opt-in checkbox for marketing; Shopify-imported
consent flags have no history rows; back-in-stock signups (plugin table) are not erased by
`anonymiseCustomer`; linking a customer to a logged request has an API but no admin UI.
