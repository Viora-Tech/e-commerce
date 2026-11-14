# Backup failure alerts; AI agents read "On the list · not live yet"

Branch `fix/backup-alert-ai-label`. No migration.

## 1. Nightly backup alerts

From 12 to 13 Nov 2026 every backup attempt was killed for running out of memory ("Killed",
exit 137) and nobody knew. A killed process cannot run its own catch block, so the counting
happens outside `backup-db.ts`:

- `deploy/backup-cron.sh` passes each attempt's exit code to `scripts/backup-alert.ts attempt <code>`
  (a separate process), and runs `scripts/backup-alert.ts check` once an hour.
- The logic is pure, in `packages/backup/src/alert.ts`, tested in
  `packages/backup/test/alert.test.ts`: one "failing" email after 3 failed attempts in one UTC
  night, or when nothing has worked for 26 hours. At most one per night, not one per 5-minute
  retry. One "recovered" email on the first success after an alert. An email that fails to send
  is retried on the next attempt or check.
- State: `BACKUP_ALERT_STATE_FILE`, default `/tmp/backup-alert.json` in the backup container.
  A container restart loses it, which only restarts the 26-hour clock.
- Sent through the platform email account (`platformEmailFromEnv`, now also exported as
  `@commerce/core/platform-email` so the script does not load all of core).

**New env (set on the Dokploy "backup" app):**

- `BACKUP_ALERT_EMAIL`: who is emailed, comma-separated. Blank: `PLATFORM_ADMIN_EMAILS`. Both
  blank: only logged.
- The backup app also needs the platform email keys to send: `SENDER_EMAIL_PROVIDER`,
  `PLATFORM_EMAIL_FROM`, `PLATFORM_EMAIL_NAME`, and the `SES_*` or `RESEND_API_KEY` keys (the
  compose `backup` service now passes them). Without them the alert is only logged.

Documented in `apps/docs/content/developer-docs/operations/backups.mdx` ("Failure alerts"),
`deployment.mdx`, `deploy/env.production.example` and `.env.example`.

Not fixed here: the out-of-memory itself. `backup-db.ts` holds the whole dump in memory
(`spawnSync` with a 1 GB buffer, then `gzipSync`) inside a 256 MB container.

## 2. AI agent channels label

"Let Koomerce manage for me" puts ChatGPT, Google AI Mode, Perplexity and Copilot in
`requested`, but nothing is sent to any agent and none can be joined automatically yet. For AI
agents only:

- Status chip: "On the list · not live yet" (new `status.listed`, `agentChipStatus` in
  `lib/channel-status.ts`), on the agent cards and the Get ready list.
- View request dialog: "{agent}: on the list, not live yet" / "We'll list your store when {agent}
  opens to stores in India. Nothing is shared until then.", button "Take off the list".
- Connect an AI agent dialog: review text, "Add to the list", toast "On the list for {agent}".
- New copy group `agentList`; Hindi overlay `data/hi/sales-channels.ts` (status chips and
  `agentList`; the rest of the page is still English, marked `untranslated`).

Social channels (Facebook, Instagram, WhatsApp, Google) are unchanged. `requestChannel` only
saves `requested`; it sends nothing. Social Connect goes through real Meta or Google sign-in when
that platform app is set up. Without it, it falls back to `requested`, and nothing in the code ever
moves a request on, so "Waiting for approval" is just as misleading there. That is left for an
owner decision.
