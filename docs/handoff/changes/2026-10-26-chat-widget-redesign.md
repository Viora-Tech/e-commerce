# Storefront chat: new look and Track my order inside the chat

- Widget shell (`apps/storefront/src/components/inbox/`): white card with the store logo (or
  initial) and an online line (`chat-header.tsx`), "Hi there" intro with a Quick help list
  (Track my order, Help me choose, Shipping and returns) and a "Popular right now" grid,
  accent shopper bubbles, an "Assistant" label on AI replies, a "Someone from <store> joined"
  divider when staff reply after the AI, one-field composer with "Answers by AI…" line and
  Sign in for guests. Full screen on phones; open/close animates from the launcher's corner.
  Colours: `--chat-accent` / `--chat-on-accent` from the widget settings, else the theme's
  `--btn-bg` / `--btn-text`. Accent fills and the header's responsive toggles use Tailwind's
  `!` so imported Liquid theme CSS (unlayered `button{…}`, `svg{…}`) can't override them.
- Track my order (`chat-track*.tsx`, `chat-order*.tsx`, `lib/chat-track-actions.ts`): guests
  enter email/mobile + order number (same `track-order:ip` rate limit and "not found whichever
  half was wrong" rule as `/track-order`); signed-in shoppers see their last 3 orders. The card
  shows a 5-step timeline mapped by `chatOrderProgress` (`lib/chat-track.ts`, tested), courier +
  AWB, Live tracking, View order (signed thank-you link), and chips that ask the chat to change
  the address or talk to a person. Expected date shows only when courier tracking has one.
- The layout passes `theme.brand.logo?.url` to `InboxLauncher` for the header avatar.
- Mockups: https://claude.ai/artifact/PaHSy9woCFvFS9akCfkcdz
