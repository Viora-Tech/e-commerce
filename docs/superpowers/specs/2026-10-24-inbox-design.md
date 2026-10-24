# Inbox app (our Shopify Inbox): design

Date: 2026-10-24. Status: approved by the owner with the answers in §0; building. Read against `origin/dev` (last migration `0160_pixels.sql`).
Research: Shopify Inbox 2026 feature survey and gap table (session scratchpad `research-inbox.md`).

## 0. Owner answers and changes (2026-10-24)

- **Q1 guests**: guests may chat; "Require sign-in" exists and is **off** by default.
- **Q2 install**: installed from the App Store, not pre-installed (not in `PREINSTALLED_APPS`).
- **Q3 price**: free on every plan (left out of `APP_PRICING`).
- **Inbox is a sales channel** (overrides §6 where different). Once installed it shows in the admin nav
  under **Sales channels** (beside Online store, Agentic sales, Social media; `apps/admin/src/data/navigation.ts`),
  only while installed. Its pages (`/inbox` and its overview) sit with the other channel pages.
- **Orders from chat are attributed to the Inbox channel**: an order counts as "from chat" when the shopper
  clicked a product, discount or cart link shared in chat, or ordered within **7 days after a staff (or,
  later, AI) message** in their conversation. Such orders get the source "Inbox" in sales-by-channel and
  sales-by-source reports (`packages/core/src/marketing/attribution.ts`, Growth sales by source), set
  `attributed_order_id`, and feed the Inbox channel page stats: conversations, orders assisted, sales from chat.
  This is its own small PR (8 below).
- **Migration number**: `0160` went to Pixels first; Inbox's tables are `0161_inbox.sql`. Columns that
  point at a staff member hold the Better Auth user id (`assignee_user_id`, `member_user_id`), like
  `created_by` elsewhere. `inbox_block` is one row per blocked value (`kind` visitor / email / ip plus
  `value_hash`) rather than three nullable columns.

## 1. Intent

Shoppers ask before they buy: size, COD, delivery date, "is this in stock". Today a Koomerce store can
only chat through the Chatwoot app, which means the merchant has to run Chatwoot and paste tokens, the
widget looks like Chatwoot rather than the theme, and staff reply outside our admin with no cart, orders
or discounts at hand. Shopify bundles Inbox for free and sells it on conversion. We build our own.

Decided by the owner (2026-10-24):
- A separate built-in app, **Inbox**, with its own tables and realtime (SSE over Redis pub/sub). It is not Chatwoot.
- A storefront chat widget that respects consent, loads lazily, gives guests a visitor id and merges the conversation on sign-in.
- An admin `/inbox` page as a full page with three panes. It has quick replies, can share a product, a discount (applied automatically) or an image, and shows a customer sidebar with orders and the live cart.
- Conversations are Open, Closed or Blocked, and can be assigned. Notifications go through the bell, browser push and an email digest.
- The **Chatwoot app stays** as an alternative. If both are installed, Inbox's widget wins and Chatwoot's is not drawn.

## 2. Goals, non-goals, anti-goals

**Goals (v1):** a widget with a greeting, business hours, an away message and optional contact capture.
Realtime messages with typing and seen marks. One inbox with Open/Mine/Unassigned/Closed/Blocked views,
search and unread counts. Cart events in the thread. Product, discount and image cards. Quick replies.
Assignment. Bell, push and email digest. Hindi and English throughout.

**Non-goals (v1):** AI suggested replies for staff (v1.5; the AI agent is in v1, §13), WhatsApp/Instagram/Messenger (v2), a mobile app, tags,
conversations as automation triggers, CSAT, and creating discounts from chat (v1 only picks existing active codes).

**Anti-goals (must not happen):**
- Orders, addresses or the cart are never shown to a guest whose email is only typed in. Shopper-side order
  lookups need a signed-in customer. Staff see "Possible match" with an *Unverified* chip.
- No third-party script and no cookie before the shopper opens the chat.
- No right-side drawer anywhere. On narrow screens the customer panel opens as a dialog.
- No second service on the 4 GB `vextro-app` box, and no long-lived Postgres connection per open stream.
- One store's spam flood never slows another store's inbox.

## 3. Data model: migration `0161_inbox.sql`

Renumbered from 0160 (Pixels took it). If another migration lands first, renumber when merging.
All tables are tenant tables with forced RLS on `store_id` (`withStore`) and ids from `newId()` (UUIDv7, so ids sort by time).
The schema goes in `packages/db/src/inbox-schema.ts`.

- `inbox_conversation`: id, store_id, `channel` ('web'; 'whatsapp' | 'instagram' | 'messenger' reserved), `status`
  ('open' | 'closed' | 'blocked'), `blocked_reason` ('spam' | 'staff'), customer_id (nullable), `visitor_key_hash`
  (sha256 of the chat cookie), contact_name, contact_email, contact_phone (`encryptCustomerPhone` + blind index),
  `contact_verified` bool, assignee_member_id, last_message_at, last_message_preview (≤ 140 chars), last_sender,
  unread_staff int, unread_shopper int, shopper_seen_message_id, staff_seen_message_id, first_response_at,
  closed_at, closed_by, started_url, `unanswered_alerted_at`, `external_thread_id` and `session_expires_at`
  (reserved for v2), `attributed_order_id` (reserved for v1.5), anonymised_at, created_at, updated_at.
  Indexes: `(store_id, status, last_message_at desc)`, `(store_id, assignee_member_id, status)`, `(store_id, customer_id)`,
  and a partial unique index `(store_id, visitor_key_hash) where status = 'open'` (one open thread per browser).
- `inbox_message`: id, store_id, conversation_id, `sender` ('shopper' | 'staff' | 'system' | 'ai' reserved), member_id,
  `kind` ('text' | 'product' | 'discount' | 'image' | 'cart_event' | 'note' | 'system'; 'template' reserved),
  body (≤ 2,000 chars), payload jsonb (variant ids, discount code id, media id, cart delta), `client_id` with a unique
  `(conversation_id, client_id)` so a resend never duplicates, external_id and delivery_status (reserved), created_at.
  Index `(conversation_id, id)`. `note` is staff-only and never sent to the shopper.
- `inbox_quick_reply`: id, store_id, title, body, `shortcut` (unique per store, typed as `/size`), position, created_by.
- `inbox_block`: id, store_id, `visitor_key_hash` / `email_hash` / `ip_hash` (one of the three is set), reason, created_by, expires_at (IP blocks last 30 days, the others never expire).
- `member_push_subscription`: id, store_id, member_id, endpoint, p256dh, auth (encrypted with `encryptSecret`),
  user_agent, last_ok_at. This is generic member-level push, used only by Inbox for now. (My call.)
- Settings live in `store.apps.settings.inbox` with no table, the way Chatwoot does it: greeting, away message, availability
  ('always' | 'hours' | 'offline'), weekly hours in `store.timezone`, contact capture ('off' | 'optional' |
  'required_when_away'), require sign-in (off), launcher position and label, sound, email fallback minutes (default 10),
  retention months (default 24).
- `MEMBER_ALERTS` (`member-account/alert-prefs.ts`) gains `inboxMessage`, and `AlertChannel` gains `'push'`, used by this alert only.

## 4. Realtime: SSE over Redis pub/sub, with a polling fallback

**Where the endpoint lives (builder's call): as route handlers inside the admin and storefront Next apps.** The
alternatives are the worker or a new `apps/realtime`:
- Same origin, so the existing cookies authenticate the stream. No CORS and no tokens.
- Merchants' custom domains work at once. Each custom domain already has a Dokploy/Traefik route to the storefront
  app, while a separate realtime app would need a second route per domain.
- The worker is not on the `web` network, has no Traefik labels, is capped at 1 CPU and 384 MB, and does image
  processing. Long-lived streams do not belong there.
- No new container on the 4 GB t3a.medium.
- Escape hatch: the hub is a plain module (`@commerce/core/inbox/realtime`, server-only). If connection counts
  ever outgrow the Next processes, it can move to a Bun+Hono `apps/realtime` behind a Traefik `PathPrefix` route.

**Can it stream through our edge?** Yes. Platform domains go through Cloudflare (proxied, Full strict) → Traefik
→ Next (Node `server.js`), and custom domains go straight to Traefik.
- Cloudflare streams `text/event-stream` but closes connections that are idle for more than 100 s, so we send a heartbeat comment every 20 s.
- Traefik has the `commerce-compress` middleware on both routers. We send `Cache-Control: no-store, no-transform`
  and `X-Accel-Buffering: no`. PR 2 checks for buffering with `curl -N` on vioratech.in. If the stream is buffered,
  the stream path gets its own router without the compress middleware.
- The Cloudflare cache rule for store pages must exclude `/inbox/*`.
- Rolling deploys (`start-first`) drop streams. EventSource reconnects with `Last-Event-ID`.

**Flow:**
1. A write (an oRPC procedure for staff, a server action for the shopper) inserts the message in a `withStore`
   transaction. After commit it runs `PUBLISH inbox:{storeId}` (list delta for staff) and `PUBLISH conv:{conversationId}`
   (full message). Dragonfly supports pub/sub.
2. Each Node process holds **one** ioredis subscriber connection (separate from `sharedRedis`, because a connection in
   subscribe mode can do nothing else). It fans messages out in-process to its open streams.
3. Streams hold no Postgres connection. On connect with `Last-Event-ID` (a message id, which sorts by time), one query
   replays the missed messages, then the stream goes live. Pub/sub is a hint and Postgres is the truth.
4. Typing is an ephemeral PUBLISH that is never stored. Each side throttles it to one per 3 s.
5. Endpoints:
   - Admin: `GET /api/inbox/stream` checks the session plus `inbox.read` per store and gets the store channel.
   - Storefront: `GET /inbox/stream`, rewritten by `proxy.ts` to `/-s/[storeId]/inbox/stream`. It checks the chat cookie
     or `wc_customer` against the conversation and gets only that conversation's channel.
6. Limits: at most 2,000 streams per process. Above that, or on any failure, the stream answers 503 and the client polls.

**Polling fallback (always built):**
- The client switches to polling if no heartbeat arrives within 10 s, or after 3 errors in a row.
- The admin polls `inbox.sync({ since })` every 4 s while the tab is visible.
- The widget polls every 4 s while open. While it is closed and a conversation was active in the last 24 h, it polls an
  unread count every 30 s while the tab is visible. That count is a cheap Redis counter.
- The activity bell keeps its 60 s poll (`POLL_MS`). It gets an Inbox row from `activity/feed.ts`, and the live stream
  bumps the row's count in the meantime.

## 5. Storefront widget

- **Launcher**: drawn on the server by the layout next to the Chatwoot slot (`app/-s/[storeId]/layout.tsx`, `consent.chatwoot`).
  It is a plain button styled with theme tokens and works on block and imported Liquid themes (`liquid-shim.ts`). It
  never renders in theme preview. No script and no cookie run until it is clicked or the shopper reopens an existing thread.
- **Lazy island**: the chat client loads on the first click, or on idle when the `wc_chat` cookie exists.
- **Consent**: the category is fixed at `necessary`. The shopper asks for the service and nothing is tracked. A footer
  line reads "{store} keeps these messages to answer you · Privacy policy".
- **Identity**:
  - Guests get the `wc_chat` cookie (httpOnly, SameSite=Lax, 1 year, 32 random bytes, stored only as a hash). It is set
    on the first message, not on open. `wc_vid` is not reused, because it is the anonymous visitor count.
  - Signed-in shoppers are bound by `currentCustomer`.
  - On sign-in, the guest's open conversation is attached to the customer. If the customer already has an open one, the
    guest messages are moved into it with the system line "Messages from before you signed in". (My call.)
- **Contents**:
  - Greeting, the hours or away line, a "Track my order" link (the existing `/track-order`), and an optional email or
    phone field. When the setting is `required_when_away`, that field is asked for when nobody is online.
  - Product cards have Add to cart (`addLineAction`). Discount cards have Apply code (`applyDiscountAction`); inactive
    codes are refused at send and at apply.
  - Images are uploaded the way the Reviews app's `/reviews/photo` does it (`saveImageForProcessing`).
- **Cart events**: `cart-actions.ts` add, remove and quantity changes post a `cart_event` system message, but only
  when an open conversation exists. It is cheap: the cookie is checked before any query.
- **Email fallback**: if no staff member replies within N minutes and a contact email exists, the shopper gets "We got
  your message, we'll reply here and by email". Later staff replies are emailed while the shopper is offline.

## 6. Admin screens

- **Sidebar**: a top-level **Inbox** entry with an unread badge, shown while the app is installed.
- **Manifest**: `packages/core/src/inbox/app.ts` (`kind: 'builtin'`, category `sales`, `admin.pages`: Inbox (root),
  Quick replies, Settings), registered in `commerce.config.ts`. The catalogue is regenerated with
  `bun scripts/gen-app-catalogue.ts`. It is installed from the App Store and is **not** in `PREINSTALLED_APPS` (Q2).
- **`/inbox`**: a full page with three panes, without the `DetailLayout` right column.
  - **List** (22rem): view tabs, search (name, email, phone, keyword, order number), rows with avatar, preview,
    `<RelativeTime>`, unread dot and assignee.
  - **Thread** (flex): header with name, status pill, Assign, Close/Reopen and More (Block, Copy link). Messages and cards
    with seen marks. The composer has quick replies on `/`, a **Product** picker dialog (up to 3), a **Discount** picker
    dialog (active codes), an image button and a Note toggle.
  - **Customer** (20rem, inline): new or returning, verified or unverified, the live cart, recent orders (needs
    `orders.read`), notes, and "Open customer".
  - Below `lg` the layout drops to two panes and **Customer** opens as a dialog. On mobile it is one pane with a back button.
- **Cards**: a Conversations card on the customer and order pages (`customerDetailCard` / `orderDetailCard`).
- **Quick replies** page: a table with a dialog form; footer buttons sit on the right.
- **Settings**: availability and hours, greeting and away text, contact capture, require sign-in, launcher, email
  fallback, retention, and "Allow notifications on this browser" (VAPID `web-push`, MPL-2.0, on the radar).
- **Account → Notifications**: an Inbox row with switches for push and the email digest.
- **Copy**: `apps/admin/data/inbox.ts` + `data/hi/inbox.ts`, read through `useCopy` / `getCopy`. Widget copy goes in the
  storefront's data file, with Hindi following the store language.

## 7. Permissions, notifications, abuse, privacy

- **Permission resource** `inbox: ['read', 'reply', 'manage']`:
  - `reply` covers sending, assigning, closing and blocking.
  - `manage` covers settings and quick replies.
  - The pickers also need `products.read` / `discounts.read`. The sidebar's orders need `orders.read`.
  - Seeding: the Owner gets everything. Roles that hold `customers.write` get read and reply. (My call.)
  - MCP: reads are reads. Sending a message to a shopper is **sensitive** and always waits for approval.
- **Notifications**:
  - An assigned conversation notifies only its assignee. Unassigned ones notify everyone with `inbox.reply` whose alert is on.
  - Push goes out at once. The email digest is a BullMQ delayed job ({inbox}-digest, delayed by the fallback minutes)
    that sends one email per member listing the unanswered threads, marked with `unanswered_alerted_at`.
- **Rate limits** (`checkRateLimit`, IP taken per `TRUSTED_PROXY`):
  - Per IP: new conversations 5 per hour.
  - Per conversation: messages 10 per minute and 60 per hour, images 5 per hour, each ≤ 10 MB.
  - Staff: 60 messages per minute per member.
  - All of these are per store, so one store's flood stays in that store's buckets.
- **Spam**:
  - A honeypot field, as in `contact-actions.ts`.
  - A guest's first message is auto-moved to Blocked (reason spam) if it has more than 2 links, or if the same body
    arrives from one IP across 3 or more conversations.
  - Staff block by visitor, email or IP. Turnstile is not used in v1 because it would put a third party on custom
    domains. (My call; "Require sign-in" is the stronger switch.)
- **Privacy (DPDP)**:
  - `anonymiseCustomer` is extended so the customer's conversations lose their contact fields, message bodies become
    "[erased]", images are deleted, and the stubs are kept for counts.
  - A guest's erasure request is matched by email.
  - `privacy/export.ts` includes the shopper's conversations.
  - A daily prune deletes conversations whose last message is older than the retention setting (default 24 months).
  - Data stays in Mumbai.
  - Chats are never used to train models (this matters for v1.5).

## 8. Testing and rollout

- **Tests**:
  - Unit: settings parsing, hours/away in the store's timezone, spam rules, token/cookie hashing, merge on sign-in, the replay query.
  - Integration (RLS): a cross-store read fails, a guest cannot read another visitor's thread, an unverified email never sees orders.
  - Realtime: the hub fan-out with a fake Redis, the 503 then polling path.
  - E2E: a guest chats, staff reply live, a discount is applied, the shopper signs in and the threads merge.
  - `bun run test:sweeps`, the `app-catalogue` sweep, and the component checker.
- **Rollout**:
  - Merge to `dev` and test on vioratech.in, including the SSE check through Cloudflare.
  - Install on Waimers first.
  - Then list it on the App Store and write the merchant guide page `/merchant-guide/apps/inbox`.

## 9. PR breakdown (small PRs into `dev`, each with its own `docs/handoff/changes/` note)

| # | PR | Status / size |
|---|---|---|
| 1 | `0161_inbox.sql`, schema, RLS, core services, `inbox` permission + seeding, oRPC router, tests | merged (#732) |
| 2 | Realtime hub, admin/storefront stream routes, `inbox.sync` polling, edge verification note | merged (#737) |
| 3 | Manifest + catalogue (sales channel), settings, quick replies and blocked senders pages, copy (en + hi) | S |
| 4 | Admin inbox per §12: Inbox home (to-dos, agent and staff cards, active status, 30-day metrics), conversations view (filters, list, thread, composer pickers, customer panel), sidebar entry under Sales channels with unread badge, bell row | M–L |
| 5 | Storefront widget per §12 (pill launcher, glass card, featured products, suggested chips), `wc_chat`, consent, cards (add to cart, apply code), image upload, cart events, sign-in merge, Chatwoot suppression; widget settings as a schema for the theme editor's App embed | M–L |
| 6 | **AI agent** per §13 (all chats / only when away / off, grounded in store data, cards, hand-off, practice scenarios, logging) | L (1.5–2 weeks) |
| 7 | Notifications: `inboxMessage` alert, push subscriptions + VAPID, digest job, shopper email fallback | S–M |
| 8 | Abuse (honeypot), erasure/export/retention prune, customer/order Conversations cards, merchant guide | S–M |
| 9 | Sales channel attribution: orders from chat (shared links, 7 days after a staff/agent message) as source "Inbox" in sales-by-channel/source, orders assisted on the Inbox home | S–M |

v1 ≈ 4–6 weeks for one stream.

**Later phases:**
- **v1.5 (M, 1.5–2 weeks)**: AI suggested replies on `packages/ai` (the same pattern as `review-reply.ts`, metered like `ai_usage`, with RLS tools for product search, a signed-in shopper's orders and policies). (The AI agent itself moved into v1 as PR 6, §13.) Analytics: conversations, first response time, and orders assisted (an order within 7 days of a conversation sets `attributed_order_id`).
- **v2 WhatsApp (M, 1–1.5 weeks, after Meta WhatsApp review)**: `handleMetaWebhook` / `whatsappEventUpdate` stop dropping inbound `messages` and route them to `channel='whatsapp'` (`phone_number_id` → store, `wa_id` → customer by phone blind index). Free text within 24 h of the shopper's last message (`session_expires_at`), then the composer switches to template mode (`notifications-whatsapp`).
- **v2 Instagram/Messenger (M, about 1 week after permissions)**: the same Meta app, the `messages` webhook fields, the Send API, the 24 h window plus the human-agent tag.

## 10. Builder's calls (owner can overturn)

- SSE in the Next apps rather than the worker or a new app.
- The chat category is fixed at `necessary`.
- A separate `wc_chat` cookie.
- Messages merge into an existing open thread on sign-in.
- One unread counter per conversation, not per member.
- Push via a generic `member_push_subscription`.
- No Turnstile in v1.
- Sending via MCP is sensitive.
- Roles with `customers.write` are seeded with reply rights.
- 24-month retention default.
- v1 shares existing discount codes only.

## 11. Questions for the owner (they change the build)

1. **Guests or sign-in only?** Recommended: guests may chat (with optional contact capture), and "Require sign-in" stays
   off by default. Shopify turns it on by default, but Indian shoppers rarely sign in before buying. → §5 identity, PR 5.
2. **Preinstalled or installed from the App Store?** Recommended: installed from the App Store (free, one click), with
   onboarding suggesting it. Preinstalling would need a data migration like 0154. → §6, PR 3.
3. **Price:** free on every plan, like Shopify Inbox? Recommended: yes (it is left out of `APP_PRICING`). If it is paid, PR 3 adds plan gating.

## 12. Matching Shopify Inbox (owner's screenshots, 2026-10-24)

**Storefront widget (PR 5)**
- Closed: a small pill launcher bottom-right, icon + label ("Chat"), in the merchant's colours.
- Open: a large rounded glassy card (about 31rem wide). Top-right: expand (full screen), dock to a side
  panel, minimise. A "Sign in" pill top-left while signed out. Intro line ("Hi there! You can ask questions
  about shopping, sizing, shipping, returns, or order status.") with two featured product cards fanned on the
  right (best sellers by default; the merchant can pick). A small disclaimer ("This chat is powered by AI and
  may make mistakes" only while the AI agent is on; "Your messages are visible to <Store>. See privacy
  policy."). Suggested-question chips: Track my order, Explore the store, Find popular products, Shipping
  and store policies. A big rounded "Ask anything…" input. The theme's font.
- **Widget settings are a schema the theme editor's App embeds panel renders** (the coordinator wires the
  panel): on/off; greeting; show featured products + pick products; colours (background, font colour,
  invert activator colours); activator icon and label, horizontal position left/centre/right, vertical
  position lowest/higher/highest; typography inherit from theme, activator font size; border radius; a
  "Manage app" link to the Inbox admin. Stored with the theme like other app embeds; PR 3's launcher
  label and position move there.

**Admin (PR 4)**
- Inbox home: banner "Collect customer emails without sign-in"; To-dos (Train your AI agent → Train agent;
  Add your staff's available hours → Add hours); Agent card (Edit, Training menu, "Assign agent to
  conversations: All conversations / Only when staff are away" + switch, accuracy/privacy notice); Staff card
  rows: Staff hours ("Available now" badge), Collect customer details ("Sign-in required" or off), Instant
  answers (count); right column: Active status (preview, edit) and Metrics, last 30 days: Conversations,
  Messages, Assisted orders, Orders per session, Satisfaction rate.
- Available hours: a toggle and from/to per weekday, an all-days toggle, the store time zone shown, "outside
  hours the agent points shoppers to <store email>", and an "Automated first reply" toggle.
- Conversations view: left filters Open / Closed, then Assigned to me, Agent conversations, Unassigned,
  Unread, Blocked, with Settings at the bottom; the list in the middle ("All clear" empty state + "View
  closed conversations"); the thread on the right ("Here's where you'll view messages…" until one is
  picked). A banner when desktop notifications are blocked.

## 13. AI agent (PR 6, owner priority 2026-10-24)

- **Setting**: AI answers all chats / only when staff are away (outside hours or nobody online) / off.
  **Off by default.** Uses `packages/ai` and the store's existing AI switch and usage limits.
- **Grounded only in this store's data**: products (titles, prices, stock, variants, descriptions),
  collections, policies (shipping, returns, refund, privacy), the store FAQ / knowledge the merchant writes
  in Inbox settings, and, for a verified shopper, their own order status (never another shopper's; a guest
  needs an email + order number match). Never invents prices, stock or policies. Answers in the shopper's
  language (English, Hindi, Hinglish).
- **Actions**: share products / add to cart / discount codes the merchant allowed, with the same cards as staff.
- **Hand-off to a person** when the shopper asks for one ("talk to a human", "agent", Hindi equivalents),
  the AI is not confident or the question is outside store data, an order problem it cannot solve (refund,
  cancel, damaged), or the shopper is upset. Hand-off posts "Connecting you to the team", marks the
  conversation **Needs human**, assigns per the routing rules, notifies staff and attaches a short AI
  summary. Outside hours it says when they will get a reply and collects an email or phone.
- Staff see AI messages labelled in the thread and can take over at any time: the AI stops on that
  conversation once a staff member replies.
- **Training**: practice scenarios (a simulated question, Response A vs Response B, or "Write response
  instead"), in Sales / Store policies / Support with levels; picks are stored as style examples in the
  agent's prompt.
- **Logging**: every AI answer and every hand-off reason, for analytics (resolved by AI vs handed off).
- Schema needs (PR 6 migration): `sender = 'ai'` (reserved in 0161), a `needs_human` flag / status on the
  conversation, `inbox_ai_event` (answer, hand-off reason, confidence, tokens), knowledge entries and
  training picks.
- Size: L, about 1.5–2 weeks after PR 5.
