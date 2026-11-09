# Plain HTML pages: Inbox chat and Chatwoot as islands (9 Nov 2026)

Phase 2 of `docs/design/storefront-plain-html.md`. Builds on the island modules of the tracking
islands PR.

- **Inbox chat button:** drawn by the server with the page (`lib/plain-html/chat-launcher.ts`),
  same corner, height, label, colours and font setting as `InboxLauncher`, with a small scoped
  stylesheet (`#wc-chat`, `!important`: the plain page has no Tailwind and the theme's `button`
  / `svg` rules must not reach it). Its module (`chat-module.ts`, 5.1 KB raw / 1.9 KB gzip) loads
  on idle, or at once on a tap before that: it keeps the button above a theme's bottom bars and
  hides it under an open drawer (the `launcher-lift.ts` rules), swaps the icon for a chevron,
  shows the unread badge, and closes on Escape.
- **Chat card in a frame:** the first tap opens `/inbox/frame` (proxy → `/-c/<store>`,
  `app/-c/[storeId]`), a bare same-origin page that draws the same `ChatWidget` filling the
  frame (`components/inbox/chat-frame.tsx`, `framed` prop). So the plain page carries no React
  until a shopper asks to chat. The page places the frame as `ChatWidget` places its card (float
  above the button, docked, full screen; full screen on a phone). The two sides talk with
  `postMessage` checked against the origin (`lib/inbox-frame.ts`): open/close, mode, unread,
  ready. Links in the chat open in the page (`<base target="_top">`). The message's page and the
  sign-in return path are the page's, not the frame's. A browser that has chatted loads the frame
  hidden after 2.5 s so replies show on the badge (as before).
- `ChatHeader` takes `wide`: inside the 25 rem frame the `sm:` breakpoint cannot tell a desktop
  from a phone, so the frame says (from the page's width) and the dock / full-screen buttons
  still show on desktop.
- **Chatwoot app:** `chatwoot-module.ts` loads Chatwoot's SDK once the store's chosen cookie
  category allows it (`necessary`: everyone), after load, and identifies the signed-in shopper
  (or resets after sign-out), as `ChatwootWidget`. The Inbox chat still wins when both are on.
- `inbox-chat` and `chatwoot` are no longer skip reasons.
