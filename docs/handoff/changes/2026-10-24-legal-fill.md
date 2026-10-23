# Legal pages and submission kit filled with the owner's business details

Every `[OWNER: ...]` and bracketed placeholder in the koomerce.app legal pages
(`apps/www/src/data/legal/`) is replaced with the owner's verified details (from Meta Business
Suite). There is no Hindi overlay for the legal pages yet, so nothing else needed changing.
`integrations/SUBMISSION.md` has the matching values.

## Values used

- **Business:** Viora India, a sole proprietorship of Kuldeep Saini (Koomerce, Waimers and Viora
  Tech are its brands). Address: 745/25, Saini Niwas, Gali Number 3, Sonipat 131001, Haryana,
  India. GSTIN 06OIEPS3969E1ZM is **not** shown: Terms has no "who we are" section with a GSTIN field.
- **Phone:** +91 94168 74123 in `siteConfig.contact.phone` (was `+91 00000 00000`; nothing reads
  it today) and the submission kit. The WhatsApp number in `siteConfig` is still a placeholder.
- **Grievance officer:** Kuldeep Saini, grievance@koomerce.app, same address. Acknowledged within
  24 hours, resolved within 15 days, never later than the DPDP Rules' 90 days.
- **Consent withdrawal:** write to support@koomerce.app with the subject "Withdraw consent" (the
  admin has no merchant consent settings page; `settings/privacy` is the store's customer requests).
- **Retention:** 90 days after account closure, then deleted or anonymised; backups 30 days;
  deletion requests completed within 30 days.
- **Sub-processors (privacy policy):** AWS (Lightsail hosting and database in Mumbai, SES email),
  Cloudflare (DNS/CDN/security, this website and its forms, Turnstile, R2 media and encrypted
  backups), Resend (fallback email), Razorpay (plan payments and UPI AutoPay), and the AI provider
  for optional AI features (Vercel AI Gateway or OpenRouter). Error tracking (GlitchTip) and logs
  (OpenObserve) are self-hosted, so not listed. Merchant-connected gateways and couriers are the
  merchant's own processors.
- **Terms:** courts at Sonipat, Haryana; liability capped at the fees paid in the 12 months before
  the claim, no indirect losses. Privacy "Last updated: 24 October 2026".
- **Cookies:** the list now names the one first-party cookie (`cookie_consent`, 1 year) and
  Cloudflare's security cookie and Turnstile. **Acceptable use:** the prohibited goods list is written out.

## Submission kit

Company name, address, phone and hosts (confirmed against `deploy/env.production.example`) are
filled. Meta: step 1.1 marked done (VIORA INDIA, portfolio 235952131917619, verified 23 Sep 2026);
app Koomerce, App ID 2698025377367158, created with its use cases; Basic and Facebook Login for
Business settings saved; data deletion URL points to /privacy until /data-deletion is deployed.
Shopify: create the app in the Waimers Partner account with the business name Viora India.
Reviewer login, secrets and the remaining confirm-items stay as `[OWNER: ...]`.

## Owner to do

- **Remove the "TEMPLATE — review with a lawyer" notice** (`legalContent.templateNotice` in
  `apps/www/src/data/legal/index.ts`) once a lawyer has reviewed the pages.
- Confirm the sub-processor list matches production (Resend only if the fallback is configured;
  the AI provider you actually set).
- After deploy, switch Meta's data deletion URL from /privacy to the values in SUBMISSION.md 1.3.
