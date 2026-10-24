# Social media: one Meta connection card

- Facebook, Instagram and WhatsApp already shared one `meta` connection (connecting a second one
  joined it without a new sign-in); the pages hid that. Now:
  - `SocialOverview.meta` (core `loadSocialOverview`): for the three Meta channels, each one's
    state and last-30-day orders and sales. Empty for Google. `META_CHANNELS` / `isMetaChannel`
    in `@commerce/core/sales-channels`.
  - `MetaConnectionCard` (`components/sales-channels/meta-connection-card.tsx`) on the three Meta
    pages: one row each with status, 30-day sales, and **Turn on** (once another is on), **Open**
    or "This page".
  - The page header says **Turn on Instagram** (one click, no dialog) when another Meta channel
    is already on, instead of **Connect Instagram**.
- Copy in `data/sales-channels.ts` → `socialPage.meta` (no Hindi overlay exists for this file).
- Merchant guide: Social media → Connect a channel.
