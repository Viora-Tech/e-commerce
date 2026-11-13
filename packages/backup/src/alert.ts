/**
 * When the nightly backup tells someone it is failing. Pure: the state is a small JSON object
 * the caller keeps in a file (`scripts/backup-alert.ts`), and every function returns the next
 * state plus the one message to send, if any. The counting lives outside `backup-db.ts` because
 * a backup killed by the out-of-memory killer never reaches its own `catch`; the cron loop sees
 * the exit code and reports it here instead.
 */

/** Defaults: alert after 3 failed attempts in one night, or 26 hours without a good backup. */
export const BACKUP_ALERT_FAILURES = 3
export const BACKUP_ALERT_STALE_HOURS = 26

export type BackupAlertState = {
  /** When this state was first written; stands in for the last success until there is one. */
  watchingSince: string
  /** ISO time of the last backup that finished. */
  lastSuccessAt?: string | undefined
  /** Failed attempts in a row, across nights. */
  failuresInRow: number
  /** UTC day (YYYY-MM-DD) of the attempts counted in `failuresTonight`. */
  night?: string | undefined
  /** Failed attempts on `night`. */
  failuresTonight: number
  /** UTC day the last "failing" alert went out: at most one per night. */
  alertedNight?: string | undefined
  /** A "failing" alert went out and no backup has succeeded since. */
  alertOpen: boolean
  /** The last failure's exit code, for the message. */
  lastExitCode?: number | undefined
}

export type BackupAlertOptions = {
  failures?: number | undefined
  staleHours?: number | undefined
}

export type BackupAlertMessage =
  | {
      kind: 'failing'
      reason: 'failures' | 'stale'
      failuresTonight: number
      failuresInRow: number
      lastSuccessAt: string | undefined
      lastExitCode: number | undefined
    }
  | { kind: 'recovered'; at: string; failuresInRow: number }

export type BackupAlertStep = { state: BackupAlertState; send: BackupAlertMessage | null }

/** The UTC day a time falls on. The backup runs within one UTC hour, so a night is one UTC day. */
export function nightOf(now: Date): string {
  return now.toISOString().slice(0, 10)
}

export function initialAlertState(now: Date): BackupAlertState {
  return {
    watchingSince: now.toISOString(),
    failuresInRow: 0,
    failuresTonight: 0,
    alertOpen: false,
  }
}

/**
 * Reads a state file's contents. Anything unreadable starts fresh, so a corrupt file can only
 * ever delay an alert by one night, never stop the backup loop.
 */
export function parseAlertState(raw: string | null, now: Date): BackupAlertState {
  if (!raw) return initialAlertState(now)
  try {
    const v = JSON.parse(raw) as Partial<BackupAlertState>
    if (typeof v.watchingSince !== 'string' || Number.isNaN(Date.parse(v.watchingSince))) {
      return initialAlertState(now)
    }
    return {
      watchingSince: v.watchingSince,
      lastSuccessAt: typeof v.lastSuccessAt === 'string' ? v.lastSuccessAt : undefined,
      failuresInRow: Number.isInteger(v.failuresInRow) ? (v.failuresInRow as number) : 0,
      night: typeof v.night === 'string' ? v.night : undefined,
      failuresTonight: Number.isInteger(v.failuresTonight) ? (v.failuresTonight as number) : 0,
      alertedNight: typeof v.alertedNight === 'string' ? v.alertedNight : undefined,
      alertOpen: v.alertOpen === true,
      lastExitCode: Number.isInteger(v.lastExitCode) ? (v.lastExitCode as number) : undefined,
    }
  } catch {
    return initialAlertState(now)
  }
}

/** Hours since the last good backup (or since watching began, when there has been none). */
function hoursWithoutBackup(state: BackupAlertState, now: Date): number {
  const since = Date.parse(state.lastSuccessAt ?? state.watchingSince)
  return (now.getTime() - since) / 3_600_000
}

/** The "failing" alert, when one is due and none has gone out tonight. */
function failingAlert(
  state: BackupAlertState,
  now: Date,
  opts: BackupAlertOptions,
): BackupAlertStep {
  const tonight = nightOf(now)
  if (state.alertedNight === tonight) return { state, send: null }
  const tooMany =
    state.night === tonight && state.failuresTonight >= (opts.failures ?? BACKUP_ALERT_FAILURES)
  const stale = hoursWithoutBackup(state, now) >= (opts.staleHours ?? BACKUP_ALERT_STALE_HOURS)
  if (!tooMany && !stale) return { state, send: null }
  return {
    state: { ...state, alertedNight: tonight, alertOpen: true },
    send: {
      kind: 'failing',
      reason: tooMany ? 'failures' : 'stale',
      failuresTonight: state.night === tonight ? state.failuresTonight : 0,
      failuresInRow: state.failuresInRow,
      lastSuccessAt: state.lastSuccessAt,
      lastExitCode: state.lastExitCode,
    },
  }
}

/** One backup attempt finished. `exitCode` 0 is a success; anything else (137 = killed) failed. */
export function recordAttempt(
  state: BackupAlertState,
  exitCode: number,
  now: Date,
  opts: BackupAlertOptions = {},
): BackupAlertStep {
  if (exitCode === 0) {
    const next: BackupAlertState = {
      ...state,
      lastSuccessAt: now.toISOString(),
      failuresInRow: 0,
      failuresTonight: 0,
      night: nightOf(now),
      alertOpen: false,
      lastExitCode: undefined,
    }
    const send: BackupAlertMessage | null = state.alertOpen
      ? { kind: 'recovered', at: now.toISOString(), failuresInRow: state.failuresInRow }
      : null
    return { state: next, send }
  }
  const tonight = nightOf(now)
  const counted: BackupAlertState = {
    ...state,
    failuresInRow: state.failuresInRow + 1,
    failuresTonight: state.night === tonight ? state.failuresTonight + 1 : 1,
    night: tonight,
    lastExitCode: exitCode,
  }
  return failingAlert(counted, now, opts)
}

/**
 * The hourly check between attempts: alerts when no backup has succeeded for `staleHours`, so a
 * loop that never reaches its backup hour (wrong BACKUP_HOUR_UTC, a container restarted after it)
 * is still noticed. Same once-per-night rule as a failed attempt.
 */
export function checkStale(
  state: BackupAlertState,
  now: Date,
  opts: BackupAlertOptions = {},
): BackupAlertStep {
  return failingAlert(state, now, { ...opts, failures: Number.POSITIVE_INFINITY })
}

/** Plain-text email for one message. `where` names the server, e.g. the R2 bucket. */
export function backupAlertEmail(
  message: BackupAlertMessage,
  where: string,
): { subject: string; text: string } {
  if (message.kind === 'recovered') {
    return {
      subject: 'Backups recovered: the nightly database backup worked again',
      text: [
        `The nightly database backup finished at ${message.at} and was saved to ${where}.`,
        message.failuresInRow > 0
          ? `It had failed ${message.failuresInRow} time(s) in a row before this.`
          : '',
        'Nothing else to do.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    }
  }
  const last = message.lastSuccessAt ?? 'none since this backup service started'
  const killed = message.lastExitCode === 137 ? ' (137: killed, most likely out of memory)' : ''
  const lines = [
    message.reason === 'failures'
      ? `The nightly database backup failed ${message.failuresTonight} times tonight (${message.failuresInRow} in a row).`
      : 'No database backup has succeeded for more than a day.',
    `Last good backup: ${last}.`,
    message.lastExitCode !== undefined ? `Last exit code: ${message.lastExitCode}${killed}.` : '',
    `Backups go to ${where}. Check the "backup" service's logs in Dokploy. It keeps retrying until the backup hour ends, then tries again tomorrow night.`,
    'You get one email per night while this lasts, and one more when a backup works again.',
  ]
  return {
    subject: 'Backup failing: the nightly database backup did not finish',
    text: lines.filter(Boolean).join('\n\n'),
  }
}
