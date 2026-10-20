/**
 * Server alerts from the Dokploy schedule `server-threshold-alerts`
 * (scripts/server-threshold-alerts.sh), which POSTs to /dokploy when CPU, memory or disk is high.
 *
 * Its CPU figure is summed over the cores (0–200% on the 2-vCPU box), while the threshold is
 * meant for the whole machine, so CPU is divided by the core count first: the payload's `cores`,
 * else the SERVER_CPU_CORES var, else 2. One hot reading is not an alert either: CPU must stay
 * over the threshold for `CPU_HOT_READINGS` readings in a row (the schedule runs every 5 minutes,
 * so about 10 minutes), then it is quiet for `CPU_QUIET_MS`.
 */
export const CPU_HOT_READINGS = 3
/** A reading more than this after the last hot one starts a new streak (cron every 5 minutes). */
export const READING_GAP_MS = 7.5 * 60_000
export const CPU_QUIET_MS = 60 * 60_000
export const DEFAULT_CORES = 2
export const DEFAULT_THRESHOLD = 85

export type ServerReading = {
  kind: 'CPU' | 'Memory' | 'Disk' | null
  server: string
  /** CPU summed over the cores, as the script measured it. */
  cpuRaw: number
  cores: number
  /** CPU for the whole machine, 0–100. */
  cpu: number
  memory: number | null
  disk: number | null
  threshold: number
}

/** "140%" or 140 → 140; anything else → null. */
export function percent(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) && n >= 0 ? n : null
}

const positiveInt = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** The schedule's payload, or null when the body is some other Dokploy notification. */
export function readServerAlert(
  body: Record<string, unknown>,
  envCores?: string,
): ServerReading | null {
  const cpuRaw = percent(body.cpu)
  if (cpuRaw === null) return null
  const cores = positiveInt(body.cores) ?? positiveInt(envCores) ?? DEFAULT_CORES
  const named = String(body.kind ?? body.title ?? '').match(/^\s*(cpu|memory|disk)\b/i)?.[1]
  const kind = named
    ? ({ cpu: 'CPU', memory: 'Memory', disk: 'Disk' } as const)[
        named.toLowerCase() as 'cpu' | 'memory' | 'disk'
      ]
    : null
  return {
    kind,
    server: typeof body.server === 'string' && body.server ? body.server : 'server',
    cpuRaw,
    cores,
    cpu: Math.round(cpuRaw / cores),
    memory: percent(body.memory),
    disk: percent(body.disk),
    threshold: percent(body.threshold) ?? DEFAULT_THRESHOLD,
  }
}

/** The CPU streak, kept in KV and written only when it changes (see `sameState` in checks.ts). */
export type CpuState = { streak: number; last: string | null; quietUntil: string | null }

export const CPU_FRESH: CpuState = { streak: 0, last: null, quietUntil: null }

export const sameCpuState = (a: CpuState, b: CpuState) =>
  a.streak === b.streak && a.last === b.last && a.quietUntil === b.quietUntil

/** What one CPU reading changes, and whether it is worth an email. */
export function nextCpuState(
  prev: CpuState,
  hot: boolean,
  now: string,
): { state: CpuState; alert: boolean } {
  if (!hot) {
    return { state: prev.streak ? { ...prev, streak: 0, last: null } : prev, alert: false }
  }
  const at = Date.parse(now)
  if (prev.quietUntil && at < Date.parse(prev.quietUntil)) return { state: prev, alert: false }
  const continues = prev.last !== null && at - Date.parse(prev.last) <= READING_GAP_MS
  const streak = continues ? prev.streak + 1 : 1
  if (streak >= CPU_HOT_READINGS) {
    const quietUntil = new Date(at + CPU_QUIET_MS).toISOString()
    return { state: { streak: 0, last: null, quietUntil }, alert: true }
  }
  return { state: { ...prev, streak, last: now }, alert: false }
}

export function serverAlertSubject(r: ServerReading): string {
  const value =
    r.kind === 'CPU' ? r.cpu : r.kind === 'Memory' ? r.memory : r.kind === 'Disk' ? r.disk : null
  return r.kind && value !== null
    ? `${r.kind} at ${value}% on ${r.server}`
    : `Server alert on ${r.server}`
}

export function serverAlertText(r: ServerReading): string {
  const lines = [
    `server: ${r.server}`,
    `cpu: ${r.cpu}% (${r.cpuRaw}% of ${r.cores} cores)`,
    `memory: ${r.memory ?? '-'}%`,
    `disk: ${r.disk ?? '-'}%`,
    `threshold: ${r.threshold}%`,
  ]
  if (r.kind === 'CPU') {
    lines.push(
      '',
      `CPU has been over ${r.threshold}% for ${CPU_HOT_READINGS} readings in a row (about ${(CPU_HOT_READINGS - 1) * 5} minutes).`,
    )
  }
  return lines.join('\n')
}
