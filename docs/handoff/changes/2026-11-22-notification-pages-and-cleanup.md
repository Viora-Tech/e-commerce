# Notification email pages, Email branding, admin component cleanup (22 Nov 2026)

Owner, 22 Nov 2026: "work on notification emails preview and edit, check Shopify UI", and "as few
components as possible, reuse them". Straight to `dev`.

## Notifications (like Shopify's)

- **Each email has its own page** `/settings/notifications/<message>` (`message-page.tsx`): subject
  over a large sample-order preview (WhatsApp tab when it has one), on/off switch, Send me a test,
  Edit, Reset to default. The list's rows open it; PreviewDialog is gone. Send me a test is one
  hook (`use-send-test.ts`).
- **Edit is a full page** `/settings/notifications/<message>/edit` (`design-editor-page.tsx`, was a
  dialog), with a leave-unsaved guard. Blocks only, no code editor (owner chose blocks).
- **Email branding** `/settings/notifications/branding`: logo, logo size, button and button-text
  colours for every email, from the live theme, live preview with ← → through the emails.
  Stored as an `email_template_design` row under `_branding` (no migration;
  `core/notifications/email-branding.ts`); `storeEmailBrand` = theme look + saved branding.
  `designedTemplates` skips keys starting with `_`.
- Fixed: a message preview ignored the store's saved design (`previewMessage`).

## Component cleanup (admin)

One `fields/switch-row` (9 → 1), `StatusLabel variant="soft"` (OrderChip gone), one
`table/delete-row-menu`, `fields/file-dropzone`, `fields/name-dialog` (5 dialogs), `hooks/use-clipboard`
+ `fields/copy-field`, Delivery options section pages and RunStatusLabel inlined, admin `dayKey`
reuses `@commerce/dates`. Follow-ups: see the audit list (useCopy for Hindi, useLoad, errorText,
status wrappers, row menus, storefront duplicates).

## Also

- Shipments › To be picked up: bulk **Cancel pickup**; Create manifest removed there. Delhivery
  books pickups per warehouse, so the executive may still collect a parcel taken off.
- Storefront proxy serves `/email/*` (route truck and social icons were broken images).
