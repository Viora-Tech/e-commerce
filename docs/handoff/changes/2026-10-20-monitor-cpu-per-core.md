# Monitor: CPU alerts use whole-machine CPU and need a sustained streak

Branch `fix/monitor-cpu-per-core`. No migration. Worker not deployed by this PR.

- **Where the numbers come from**: the Dokploy server schedule `server-threshold-alerts` (every
  5 minutes on koomerce-app) measures CPU, memory and disk and POSTs `/dokploy` on
  `koomerce-monitor`. Its CPU is summed over cores (0–200% on the 2-vCPU t3a.medium), but was
  compared with an 85% whole-machine threshold, so it fired at ~43% real use ("CPU at 140%").
  The title also used `$(hostname)`, which still says `vextro-app`.
- **Worker** (`apps/monitor/src/server.ts`, wired in `index.ts`): a `/dokploy` body with a `cpu`
  field is read as a server reading. CPU is divided by `cores` from the payload, else the
  `SERVER_CPU_CORES` var (`wrangler.jsonc`, `"2"`), else 2. Subject is
  `Dokploy: CPU at 70% on koomerce-app` (the `server` field, never the hostname); the body shows
  `cpu: 70% (140% of 2 cores)`. CPU emails only after **3 hot readings in a row** (each within
  7.5 minutes of the last, so ~10 minutes), then stays quiet for an hour. The streak lives in KV
  key `server:cpu` and is written only when it changes (at most ~4 writes per hot episode, none
  while CPU is fine). Memory and disk email at once, as before. Other Dokploy notifications are
  unchanged. Tests: `src/server.test.ts`.
- **Schedule script** (`apps/monitor/scripts/server-threshold-alerts.sh`): must replace the script
  in the Dokploy schedule, because the old one dedupes every kind to one POST an hour, so a CPU
  streak can never reach 3. The new one measures CPU over 5 s from `/proc/stat`, sends `cores`
  (`nproc`) and `kind`, posts CPU on every hot run (whole machine ≥ 85%), keeps the hourly dedupe
  for memory and disk, and names the server `koomerce-app`. Set `URL` to the existing
  `/dokploy?token=…` URL from the current schedule. Until it is replaced, the worker already stops
  the false alerts (140% → 70%), but real CPU alerts cannot fire.
- **Deploy**: `cd apps/monitor && bunx wrangler deploy`, then paste the script into the schedule.
