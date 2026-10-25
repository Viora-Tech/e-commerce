# Inbox PR 5: the storefront chat widget

**Branch** `feat/inbox-widget`, stacked on `feat/inbox-admin` (PR 4). Design §5 and §12. No migration.

- **Launcher**: a small pill ("Chat" with an icon) drawn by the store layout on block and imported Liquid
  themes, never in a theme preview, in the merchant's colours and position. It is the same for every visitor
  (edge-cached pages stay shareable). The chat bundle loads on the first click, or on idle once this browser
  has chatted (a `localStorage` flag; the `wc_chat` cookie is httpOnly). When Inbox is installed, Chatwoot's
  chat is not drawn.
- **Widget** (`components/inbox/chat-widget.tsx`): a large rounded glassy card (31rem) with full screen, dock
  to the side and minimise; a Sign in pill when signed out; the greeting with online/away; two featured
  products (the merchant's picks or the best sellers, with Add to cart); the privacy line; suggested
  questions (Track my order opens `/track-order`); the thread with product cards (Add to cart via
  `addLineAction`), discount cards (Apply code via `applyDiscountAction`), photos and cart lines; Seen and
  Typing…; contact capture (optional, or required while away); and the "Ask anything…" field with a photo
  button. Theme font and colours through CSS variables with system-colour fallbacks; no hex colours.
- **Server** (`lib/inbox-actions.ts`): `chatStateAction`, `sendChatAction` (mints the `wc_chat` cookie on the
  first message, honeypot, per-store rate limits, spam, blocks, sign-in switch), `chatSeenAction`,
  `chatTypingAction`, `chatCardsAction`; events publish after the write commits. `POST /inbox/photo` saves a
  photo like the Reviews app and answers a signed token, so a message attaches only this browser's upload.
- **Sign-in merge**: whenever a signed-in shopper's browser also carries a guest chat cookie, the guest thread
  joins their customer (`chatIdentity`), whichever sign-in path they used.
- **Cart lines**: `addLineAction` / `setQuantityAction` post "added / removed / changed" into the open thread
  (with the cart id, so the staff panel shows a guest's live cart); no query unless the browser has chatted.
- **Widget settings for the theme editor**: `@commerce/core/inbox` `InboxWidgetSchema` + `INBOX_WIDGET_FIELDS`
  (on/off, featured products, background and font colour, invert activator, icon, label, horizontal and
  vertical position, inherit font, activator font size, border radius), stored as `widget` in the Inbox
  settings and saved with `inbox.settings.save({ widget })`. The coordinator's App embeds panel renders the
  field list. The old launcher label/position settings are gone.
- **Not yet**: storefront copy is English only (the storefront has no language overlay yet); the AI
  disclaimer line appears with the AI agent (PR 6); shopper email fallback and notifications are PR 7.
