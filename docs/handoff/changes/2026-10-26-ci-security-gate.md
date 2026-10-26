# CI: re-enabled as a merge gate, memory-capped so it finishes

**Branch** `security/ci-gate` from `dev`. Closes the "verification isn't continuous" gap from the
A+ review: the DB-backed security tests (the cross-store RLS leak test in `@commerce/db` /
`@commerce/core`, the payment webhook underpayment guard in `@commerce/core`) existed but ran only
when someone ran them by hand. Now they gate every merge.

## Done

- **Triggers restored** (`.github/workflows/ci.yml`). `on:` now fires on `pull_request` (every PR,
  which target `dev` or `main`) and `push` to `dev` and `main`, plus the existing manual
  `workflow_dispatch`. Paused since 2026-10-02; re-enabled 2026-10-26.
- **Cancel-in-progress concurrency group** so a new push supersedes an older in-flight run on the
  same ref (saves runner minutes, mirrors `release.yml`).
- **Memory fix** — the reason it was pausable in the first place. The runner is 2 cores / ~7 GB.
  The default run has turbo fan out ~10 packages at once, each `vitest` spawning `TEST_WORKERS=3`
  forks with a Postgres copy apiece → ~30 node processes + DB copies → the runner OOM-kills the job.
  Fix: job-level `env: TEST_WORKERS: '1'` (one worker + one DB copy per package, via
  `parallelDbTests()` → `{ fileParallelism: false, maxWorkers: 1 }`) and `--concurrency=1` on the
  test step so only one package's vitest runs at a time. Correctness over speed; raise later once a
  green baseline exists.

## Not verified locally

The DB suites need Postgres, which is unreachable from the Windows dev shell (known local-env
issue), so this change is **proven by its own PR run**: opening the PR triggers CI on this branch
(the `pull_request` version of the workflow is the PR's own), which is the first real green run.
**Do not merge until that run is green.** If it still OOMs or times out, the next lever is sharding
the test job by package group rather than raising concurrency.

## Follow-up

Once a green baseline is established, try `TEST_WORKERS: '2'` + `--concurrency=2` to cut wall-clock,
and watch peak memory in the run's timing.
