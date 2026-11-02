# Brand email design for all 53 notification emails

Owner, 3 Nov 2026: emails must look premium and carry each store's own brand. Picked the "Brand"
direction (mockup: https://claude.ai/artifact/UuuAnAcR3UhHjWnrQswsA6) with Plus Jakarta Sans.

- `packages/notifications/src/emails/*`: new shell (logo + menu row, full brand-colour hero with a
  big uppercase title and a code / amount / product card, step tracker for delivery and returns,
  order panel with photos and GST, colour "Need help?" block, dark footer with socials and links).
  Buttons always centred; flat colours only (no gradients or textures). Team alerts and platform
  mail (`INTERNAL` in templates/index.ts) skip the menu and help block.
- `TemplateData.brand` (`EmailBrandInfo`): logo, light-scheme button colour, socials, contact
  email/phone, address, primary domain. Filled once per send by `storeNotificationChannels`
  through `withEmailBrand` (core `notifications/email-brand.ts`), so no caller builds it. Previews
  (Settings → Notifications, order "Review email", cart recovery) load the same brand.
- Copy: `sharedContent.heroTitles` (one per template), step labels, layout labels.
