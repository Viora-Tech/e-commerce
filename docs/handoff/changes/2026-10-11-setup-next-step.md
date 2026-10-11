# Setup "what's next" prompt from any page (2026-10-11)

- One source of truth for the setup tasks: `packages/core/src/settings/setup-tasks.ts`
  (`SETUP_ITEM_IDS`, `pickNextSetup`, `setupProgress`, tests beside it). The api service and
  `data/settings.ts` import it; the duplicated `SetupItemId` types are gone.
- `store.setupChecklist` now returns `{ items, done, total, next }` (one query) and takes an
  optional `{ after }` task: next is the first undone task after it, wrapping round.
- `hooks/use-setup-next.ts`: after a successful save, `announceSetup(task)` shows one toast
  ("Store details saved · 2 of 7 set up. Next: Payments [Set up now] [Don't show again]").
  Silent when setup is complete, when the task just saved is the only one left and unfinished,
  or after "Don't show again" (cookie `setup_next_off`, per browser). Copy in
  `settingsHomeContent.next` (+ Hindi).
- Wired on: Store details, Payments (methods + gateway connect), Shipping (settings + zones),
  Taxes (rules + GST number), Domains (connect), Notifications (sender email), Policies (editor +
  settings). The payments setup wizard keeps its own guided steps and is untouched.
- Home's three "Finish setting up" cards still read app signals, not this list (Figma-matched).
