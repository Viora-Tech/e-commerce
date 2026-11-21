# Drag-and-drop editing of transactional emails (Edit design)

Branch `feat/email-dnd-editor` (from `origin/dev` 9640c0e1e). Owner decision 21 Nov 2026: merchants
edit every store transactional email with drag and drop; the order-data blocks are locked.

## What a merchant can do

Settings → Notifications → **Edit design** (pencil on each email row; "Own design" chip once
saved). The editor opens on today's email as blocks. Add logo + menu, heading, text, image (media
library), button (link picker for products/collections), divider, spacer, social links,
questions box, footer; drag to reorder (SortableStack, keyboard too); edit the selected block;
change the subject; live preview with the sample order (desktop / mobile); **Reset to default**;
**Save design**. Variables `{{customer_name}}`, `{{order_number}}`, `{{store_name}}`... per
template; unknown ones are flagged in red and render empty.

Locked (move only, never removed or edited, always real data): every built-in block of the
composer except plain lines (`text`) and dividers: route ticket, items + totals, address/payment
columns, facts, stats, status, notice, code (login/OTP), coupon, products, attachment, quote,
parcels, the main button and app links. The intro (kicker, title, opening line) cannot be removed
either; its words can be overridden (empty = built-in).

## Design

- Data: table `email_template_design` (store_id, template, design jsonb, updated_by), unique per
  store + template, RLS. **Migration 0261** (`0261_email_template_design.sql`, journal `when`
  1795280900000, after 0260). Classified ADMIN in `storefront-cache.ts`. No row = built-in email,
  byte-for-byte unchanged (checked by hashing all 59 templates before/after).
- Model (`packages/notifications/src/design/`): `EmailTemplateDesign` = `{ version: 1, subject?,
  blocks, removed }`. Blocks are free blocks, one `intro`, and `slot` blocks naming the
  template's own blocks by `<kind>#<n>` (n-th block of that kind in the composer output).
  `defaultEmailDesign(t)` derives the list from the composer with the sample data;
  `designSlots(t)`, `variablesFor(t)`.
- Render: `renderEmail` checks `d.design` (`design-for.ts`): parse (`parseEmailDesign`, lenient,
  drops bad blocks) → `resolveDesign` over the real composer blocks. A locked slot the JSON
  leaves out is put back next to its neighbours; a slot the sample never showed (conditional
  blocks) is also inserted; only removable slots listed in `removed` stay out. `DesignedEmail`
  draws it in `EmailLayout bare` (header, help box and footer are blocks now: `emails/header.tsx`,
  `help-box.tsx`, `SocialRow` in `footer.tsx`). Plain text = built-in text with intro overrides
  and the merchant's own blocks' words after the intro. Subject: hand-typed custom > design >
  built-in. Invalid design or a render error → `console.warn` and the built-in email.
- Send path: `withEmailDesigns` (core `notifications/email-template-design.ts`) wraps every
  email channel in `storeNotificationChannels`, so the worker, test sends, codes and automations
  all carry the design; loads once per template; a load error logs and sends built-in. WhatsApp
  and SMS untouched. Team reports and platform mail never take a design (`designableTemplate`).
  Review-email previews (`core/notifications/preview.ts`) include it.
- Validation: `EmailTemplateDesignSchema` (zod, core): block type whitelist, sizes
  (`DESIGN_LIMITS`: 60 blocks, 2000-char text, 64 kB), links http(s)/mailto (variables allowed),
  images https or `/media/...` (resolved against the shop URL at render), no removing a locked
  block, unique ids, one intro. Text is never HTML: React escapes it.
- API (`packages/api/src/routers/notifications.ts`): `design` (SETTINGS_READ), `saveDesign`,
  `resetDesign` (SETTINGS_MANAGE), `previewDesign` (SETTINGS_READ, draft input, 120/min/store).
  Overview rows carry `designable` and `designed`. MCP docs regenerated; `notifications.design`
  listed as a read.
- Admin: `apps/admin/src/components/notifications/design/*` (dialog, sidebar, block list/row,
  settings, palette, preview, fields, `design-state.ts`); copy `data/email-design.ts` + Hindi
  `data/hi/email-design.ts`. Client imports only `@commerce/notifications/design` (pure subpath).

## Why not the GrapesJS canvas itself

The campaign visual builder stores free-form MJML/HTML. It cannot keep order blocks locked and
filled with real data on every send, and its output is not a block list. Edit design reuses
the builder's pieces instead (link picker `builder-link-dialog`, media picker, SortableStack)
and the same block vocabulary (logo, social, footer, button, divider, spacer, image, text).

## Tests

Ran: `packages/notifications` all (110 pass, incl. new `test/design.test.ts`: default design
equals built-in for every template, saved design renders with variables, locked blocks always
present, sign-in code kept, invalid JSON falls back, escaping and unsafe links/images, unknown
variables); `packages/core/src/notifications/email-template-design.test.ts` (zod + channel
wrapper, 5 pass); admin `design-editor-sidebar.test.tsx` (lock behaviour, 4 pass) and
`src/lib/i18n.test.ts`. Typecheck clean for notifications, db, core, api, admin, worker apart from
errors already there from this worktree's stale node_modules (snapmint, pdf-lib, write-excel-file,
web-push, puck `fields`).

Written, **not run**: `packages/api/test/notifications-design.test.ts` (DB: save, overview flag,
cross-store isolation, preview) — the api suite cannot load here (`@commerce/payments-snapmint`
missing from node_modules). Run it on dev after `bun install` + `db:migrate`.

## Left / ideas

- Emails are English only (no customer language in `TemplateData`), so design text is one
  language; Hindi text per block can be added once emails get a locale.
- No two-column layout block yet; no per-block colours (buttons stay ink like the built-in).
- Variables in the free text do not include money breakdowns; add to `design/variables.ts`.
- Slot keys are `<kind>#<n>`; if a composer later adds a conditional block of the same kind
  before another, a saved design's order for those two may swap (data is never lost).
