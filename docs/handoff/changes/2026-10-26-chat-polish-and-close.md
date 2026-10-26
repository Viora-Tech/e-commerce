# 2026-10-26 Inbox: chat widget polish and the close circle

## Storefront chat widget

- **Logo**: the chat header's avatar now comes from `apps/storefront/src/lib/inbox-logo.ts`
  (`chatLogoUrl`): an imported Liquid theme's own header logo first
  (`liquidThemeLogoUrl` in `packages/core/src/theme-import/logo.ts`: an `image_picker` setting
  named like `logo` on a header-group section, else in `settings_data.json`; plain `logo` wins
  over `logo_transparent` and similar variants; `shopify://` references skipped), then
  `theme.brand.logo`, the checkout branding logo, the favicon; the letter avatar last.
  `importedTheme` in `lib/liquid-theme.ts` is now exported for this.
- **Theme CSS leakage**: imported themes' unlayered CSS (e.g. Glide's uppercase heading font)
  beat our layered Tailwind utilities. Both roots (launcher button, chat card) carry
  `CHAT_GUARD` (`lib/inbox-guard.ts`): `:where(root) *` resets margin, text-transform,
  letter/word spacing, font family/size/weight/style, line-height and text-shadow with
  `!important` at zero specificity. Every typography and margin utility in
  `components/inbox/*` is now `!` (one class beats `:where`), form fields are fully `!`, and
  image sizing is `!` (themes' `img { height: auto }`). `inheritFont: false` now really uses the
  system font stack (it used to inherit the body font anyway).
- Sweep: `apps/storefront/src/lib/inbox-guard.test.ts` fails on a bare typography/margin
  utility in `components/inbox`, a heading without its own `!` size and weight, or a root
  without the guard.

## Admin Inbox: close circle

- Conversation status already existed (`open | closed | blocked`, with auto-reopen on a
  shopper message or a staff reply). No migration.
- New `all` view (open + closed) in `INBOX_VIEWS`, `listConversations` and `inboxCounts`;
  the left rail shows Open, Needs a person, Closed, All.
- `components/inbox/conversations/close-button.tsx`: Shopify's ✓-in-a-circle (Reopen icon on a
  closed chat), on the thread header (replaces the outline Close/Reopen button) and on each
  list row on hover or keyboard focus (replacing the time), for members with `inbox.reply`.
- `conversations-page.tsx` owns the change: optimistic list/count/thread update, toast
  "Conversation closed" with Undo, rollback (thread status reverted + list refetched) and an
  error toast on failure. The thread pane follows changes made from the row or Undo via
  `statusChange`, and flips a closed thread to open when a shopper message arrives live.
