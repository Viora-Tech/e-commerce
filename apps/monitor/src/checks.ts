/**
 * What the monitor checks. Each is one GET that must answer 2xx within the timeout; a check
 * is only reported down after `FAILS_BEFORE_DOWN` misses in a row, so one slow answer during
 * a deploy is not an alert.
 */
export type Check = { id: string; name: string; url: string }

export const CHECKS: Check[] = [
  { id: 'api', name: 'API (worker)', url: 'https://api.koomerce.app/health' },
  { id: 'admin', name: 'Admin', url: 'https://admin.koomerce.app/login' },
  {
    id: 'storefront',
    name: 'Storefront (Waimers)',
    url: 'https://waimers.vioratech.in/api/health',
  },
  { id: 'www', name: 'Landing site', url: 'https://koomerce.app/' },
  { id: 'docs', name: 'Docs', url: 'https://docs.koomerce.app/' },
]

export const TIMEOUT_MS = 10_000
export const FAILS_BEFORE_DOWN = 2

/** What the last runs saw for one check. */
export type CheckState = { fails: number; down: boolean; since: string | null; detail: string }

export const FRESH: CheckState = { fails: 0, down: false, since: null, detail: '' }

/**
 * Whether a run changed anything worth storing. KV on the free plan allows 1,000 writes a day
 * and the cron runs 288 times a day per check, so state is written only when it changes.
 */
export const sameState = (a: CheckState, b: CheckState) =>
  a.fails === b.fails && a.down === b.down && a.since === b.since && a.detail === b.detail

/** What one run changes, and whether that is worth an email. */
export function nextState(
  prev: CheckState,
  ok: boolean,
  detail: string,
  now: string,
): { state: CheckState; event: 'down' | 'up' | null } {
  if (ok) {
    return prev.down ? { state: FRESH, event: 'up' } : { state: { ...FRESH }, event: null }
  }
  const fails = prev.fails + 1
  if (!prev.down && fails >= FAILS_BEFORE_DOWN) {
    return { state: { fails, down: true, since: now, detail }, event: 'down' }
  }
  return { state: { ...prev, fails, detail }, event: null }
}
