# Page pass 13: Sales channels (agentic sales, social media, Inbox)

Audit section 7, row 13 (`/sales-channels/*`). Visual and state consistency only: every connect,
request, withdraw, sync, pause, disconnect, publish and save works as before. The "Waiting for
approval" steps (What happens next / Connect now) are unchanged.

## Already done before this pass (checked, left alone)

- Wave 2: no KitButton left in sales channels; the social sales chart (ChartCard) is already a
  DataCard; the channel orders card is on SimpleTable; the Meta tabs are PillTabs; dialogs are on
  the shell (ConnectSteps, FormDialog, ManageChannelDialog + ConfirmDialog) with busy guards.

## Failed loads

- **Agentic sales, Catalog readiness, Agent controls, Facebook/Instagram/WhatsApp/Google:** a
  failed read used to say "Sales channels unavailable — you need access to the online store"
  whatever went wrong. Now a timeout or crash shows "Could not load sales channels" with Try
  again (reads the page again); only a real FORBIDDEN shows the no-access words (same text as
  before, now on the shared no-access state).
- **Inbox, Conversations, Knowledge base, Quick replies, Inbox settings:** any failure used to
  say "Inbox is not installed — install it". Now only the API's "install the Inbox app first"
  shows that; no access shows no-access; anything else shows "Could not load the inbox" with Try
  again. The Inbox home's four extra reads (counts, metrics, quick replies, storefront address)
  land there too instead of the generic error page.
- **Knowledge base, Quick replies, Blocked senders:** on `useLoad`. A failure shows "Could not
  load …" with Try again under the table's own header (also when a refresh after a save, move,
  publish or delete fails; before, old rows stayed silently). Blocked senders used to show
  "Nobody is blocked" on a failed read.
- **Conversations list:** a failed list read sat on the skeleton forever; it now says "Could not
  load conversations" with Try again in the list pane.
- New: `components/sales-channels/server-read.ts` (`read`, `failed`, `readFailure`),
  `read-failed-page.tsx`, `components/inbox/inbox-read-failed.tsx`. New copy (+ Hindi):
  `salesChannelsLoadContent.failed` (new `data/sales-channels-load.ts`: `data/sales-channels.ts` is at the 500-line cap), `inboxContent.loadFailed`, `blocks.loadFailed`,
  `quickReplies.loadFailed`, `inboxKnowledgeContent.loadFailed`, `list.loadFailed`.

## Loading screens

Before, every sales-channels route drew the generic list skeleton (and the Inbox lists then drew
a second, different slab). Now each route has a `loading.tsx` in its own frame:

- Agentic sales, readiness, controls, a social channel, Inbox home: `DetailPageSkeleton
  frame="columns"` with the page's header buttons, tiles and main/side cards.
- Inbox settings: one column of five cards.
- Knowledge base and Quick replies: the real title and the real table header over placeholder
  rows (`inbox-list-skeleton.tsx`), the same `InboxTable` the page draws while its read runs.
- Conversations: the three-pane frame (`conversations-skeleton.tsx`, which also owns the frame
  class the page uses).

## One shell

- Agentic get-ready, Catalog readiness, Agent controls, the social channel page and Inbox home
  use PageColumns (23.5rem side column, 1.5rem gaps, the shorter column stays in view) instead
  of four hand-made grids (20rem, 22rem, 22rem, 2fr/1fr; 1rem–1.25rem gaps).
- **Catalog readiness: the score card moved from the left to the side column on the right**, like
  every other page with a side column.
- Inbox pages: the inner `gap-5` wrappers are gone (PageBody sets the 1.5rem rhythm).

## Cards, banners, fields

- Get ready: the "Steps" list is a DataCard (was a hand-made bordered list with an h3 above it).
- Agentic overview: the "no agent yet" empty state is `EmptyState variant="page"` (was a section
  empty state with hand-copied card classes). The agent cards use `surface-card`.
- Inbox home: the four SettingsCards are DataCards; the "collect contact details" banner is
  `Alert tone="info"` with its button in the action slot (was `rounded-xl surface-banner`).
- Sync status bar (every channel page and Agentic sales): drawn with Alert. Shared = success,
  waiting = warning, not connected = neutral, stopped = danger; the progress bar, "Updated …" and
  the button sit in the action slot. Only a stopped sync is announced as an alert.
- Rejected products under the bar: `Alert tone="warning"` (was a plain bordered box).
- Connect dialogs and the ChatGPT request dialog: the grey info boxes are Alerts; labels are
  Field/FieldLabel/FieldDescription (account name, OpenAI endpoint and key, hidden tags, hold
  amount); the share and collection checkboxes are Field rows. `SwitchRow` is on Field.
- Catalog readiness: the severity filter is PillTabs with counts (was hand-made pill buttons).
- Meta connection card: "Turn on" spins on the pressed row. Knowledge base "Bring over" spins.
- Blocked senders: its loading slab was `rounded-2xl` (banned); it is now the table with
  placeholder rows.

## Tests

- `components/sales-channels/server-read.test.ts`: FORBIDDEN → no-access, PRECONDITION_FAILED →
  not-installed, anything else → error; answers pass through.
- `components/inbox/inbox-table.test.tsx`: header + placeholder rows while loading; "Could not
  load …" with Try again under the header (also over old rows); no-access with no retry; rows
  and empty state once loaded.

## Shared files touched

None outside sales channels and Inbox. (`SettingsTable`, `SettingsRow`, `SettingsCard`,
`DetailPageSkeleton`, `PageColumns`, `Alert`, `PillTabs`, `TableSkeletonRows` are used, not
changed.)

## Left alone

- Agent controls keeps both the header Save and the SaveBar (settings step 9 decides one save
  pattern).
- Inbox settings keeps SettingsCard/SettingsRow: it is a settings page and follows the settings
  pass.
- The social page's secondary readiness read still falls back to "no issues" when it fails.
- The get-ready headline keeps `text-2xl` (no token between section title 1.25rem and page title
  1.75rem).
- The conversation thread pane, composer and customer panel (chat UI) were not reworked.
