# Worker sweeps share one queue (8 Nov 2026)

The 27 scheduled sweeps (unpaid-order expiry, pre-order balances, shipment tracking, order push,
payment fees, domain and certificate checks, sender email, marketing and automation ticks,
prunes, billing, home cards, Search Console, rollouts, FX rates, bug-report sync…) used to run on
a queue and a BullMQ worker each, so each held its own blocking Redis connection and woke on its
own. They now run on one queue, `{system}-sweeps`, with one worker (`apps/worker/src/sweeps.ts`,
concurrency 6). Each job's name is the sweep (the label it logged under before), so log
searches for `name: unpaid-order-expiry` still work; the wide event's `queue` is now `sweeps`.

- **Stays on its own queue:** outbox relay (admin nudges it), channel sync (per-store jobs), heartbeat.
- **Never overlaps itself:** a run that comes due while the same sweep still runs is skipped
  (`{ skipped: 1 }`), and the next one runs on time.
- **First boot after deploy:** each sweep's old scheduler is read; an `every` sweep starts on the
  shared queue at the old next-run time (`startDate`), a cron sweep keeps its pattern and runs
  once if its old run was due and not taken. Then the old scheduler is removed and the old queue
  deleted (`obliterate`); a queue with an active job is retried two minutes later, by force.
  Later boots find nothing to retire.
- **Rollback to an older image:** the old code recreates its own schedulers (they run once at
  start); the shared queue's schedulers then sit idle with one waiting job each, harmless.
- Sweep modules now return `{ run }` instead of `{ queue, worker }`; the schedule table is in
  `apps/worker/src/index.ts` (`sweepList`).
