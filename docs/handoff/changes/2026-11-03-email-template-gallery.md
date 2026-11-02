# Email template gallery: 20 ready-made designs, saved templates you can update and rename

Owner, 3 Nov 2026: "add as many templates as you can… make it possible to edit or create new
templates". The visual builder's Templates dialog is now a gallery.

- `packages/core/src/marketing/email-starters.ts`: 20 MJML starters (sales, launches, loyalty,
  festivals, updates) in the Brand look: store logo + menu row, flat brand-colour hero, centred
  buttons, the store's newest products, coupon blocks, socials and the unsubscribe footer.
- API `marketing.emailTemplates.starters` builds them for the store (logo, colour, 6 newest
  active products with photos) and compiles each for the thumbnails; `emailTemplates.update`
  saves over or renames a saved template (`updateEmailTemplate` in core).
- Admin `builder-templates-dialog.tsx`: Ready-made tab (category chips, live thumbnails, a Blank
  email), Your templates tab (save current as new, Open, Update the one you opened, Rename,
  Delete). A new design opens on the gallery.
- `productGridMjml` now draws the Brand product card (photo tile, centred title, brand price).
