# Imported themes: contact and advice forms (Forms app) and related products (issue #282)

- Branch `feat/theme-contact-related`, migration `0090_forms_contact_message` (table
  `contact_message`, RLS via `apply_store_rls()`; snapshot and journal added).
- **Forms app** (`packages/plugin-forms`, built-in, installed per store under Apps):
  `{% form 'contact' %}` posts to `/theme-actions/contact` (`apps/storefront/src/lib/contact-actions.ts`).
  Honeypot field `contact_website` (added by the form tag), per-IP+store rate limit (5 per
  10 min), store id from the hostname only. Saves the message and writes outbox event
  `contact.message_received`; relay queues the new `contact_message` notification; the worker
  (`apps/worker/src/notifications.ts`) emails the store contact address via core
  `deliverToStoreContact`. Admin: Apps, Forms, Submissions (`api.forms.submissions.list`,
  needs `customers:read`). Erasure of a customer also deletes their messages.
- Without the app installed the theme's contact form renders "This form is not available right
  now" (`LiquidRequest.formsAvailable`). After a post the page returns with `form_posted=contact`
  (`form.posted_successfully?`) or `contact_error` (`form.errors`, `default_errors`).
- **Related products** (core): `GET /theme-actions/recommendations` (the shim maps
  `/recommendations/products`) renders the theme's section with `recommendations.products` from
  `relatedProductIds` (`packages/core/src/theme-import/related.ts`): shared collection, then
  product type, then tags; not itself, active and in-stock only. Section ids like
  `template--123__product-recommendations` resolve to the section type by their key.
- Swap table rows updated (contact needs the app; recommendations replaced).
- Left out: the section's saved settings are not applied to the recommendations render (it uses
  schema defaults, like other `?section_id=` renders); `/recommendations/products.json` is not
  implemented; no reply-from-admin or read/unread state on submissions; Hindi copy for the
  Submissions page (falls back to English); api package tests (incl. cross-store leak) could not
  run in this worktree (`@aws-sdk/middleware-sdk-s3` failed to link on Windows).
