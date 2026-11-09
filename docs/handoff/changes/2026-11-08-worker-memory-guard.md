# Worker memory guard (8 Nov 2026)

The worker now watches its own memory (`apps/worker/src/memory-guard.ts`, started in `index.ts`)
against its container limit (cgroup `memory.max`, then v1, then `WORKER_MEMORY_LIMIT_MB`, then the
machine). Every 5 seconds:

- **70% (`WORKER_MEMORY_SLOW_PCT`)**: bulk queues pause (imports, images, exports, bulk AI, campaign
  sends, restock blasts, channel sync, housekeeping sweeps); other queues run at half concurrency.
- **85% (`WORKER_MEMORY_CRITICAL_PCT`)**: everything pauses except heartbeat, notifications (order
  emails), the outbox relay, unpaid-order expiry, pre-order balances and payment fees; a GC runs.
- **Below 60% (`WORKER_MEMORY_RESUME_PCT`)**: all resume. Critical comes down to slow below 70%.
- **95% (`WORKER_MEMORY_EXIT_PCT`) for 60 s (`WORKER_MEMORY_EXIT_AFTER_S`)**: clean shutdown (running
  jobs get 30 s), so Docker restarts the worker instead of the kernel OOM-killing something.

Pausing is local (`worker.pause(true)` / `resume()`), never a queue pause in Redis: waiting jobs
stay queued, running jobs finish. Every level change is logged (`worker memory level changed`,
area `memory`, with rss/heap/limit MB and the paused queues). Priorities by queue label are in
`priorityOf`; a new queue is `normal` unless added there.

Scheduled sweeps share one worker since #1350 (`sweeps`). The guard never pauses that worker;
each sweep job is checked by its own name instead (`sweepRuns`): unpaid-order expiry, pre-order
balances and payment fees run at every level, housekeeping sweeps wait at 70%, the rest at 85%.
A held-back sweep returns `{ deferred: 1 }` and runs again on its next turn.

Live limit today: 1.5 GiB (Dokploy), so slow at about 1.05 GiB, critical 1.28 GiB, exit 1.43 GiB.
