#!/usr/bin/env bun
/**
 * Tells the platform owner when the nightly backup keeps failing, and when it works again.
 * Called by deploy/backup-cron.sh, never by backup-db.ts itself: a backup killed by the
 * out-of-memory killer (exit 137) cannot run its own catch block, but the loop around it sees
 * the exit code and runs this as a separate, small process.
 *
 *   bun scripts/backup-alert.ts attempt <exit code>   after every backup attempt
 *   bun scripts/backup-alert.ts check                 once an hour, for "no backup in 26 hours"
 *
 * The counting is `@commerce/backup`'s alert.ts (pure, tested); this file only keeps its state in
 * BACKUP_ALERT_STATE_FILE (default /tmp/backup-alert.json) and sends the email through the
 * platform email account to BACKUP_ALERT_EMAIL (or PLATFORM_ADMIN_EMAILS). It always exits 0, so
 * a broken alert never stops the backup loop. See docs/ops/backups.md.
 */
import { readFile, writeFile } from 'node:fs/promises'
import {
  type BackupAlertMessage,
  backupAlertEmail,
  checkStale,
  parseAlertState,
  recordAttempt,
} from '@commerce/backup'
import { loadBackupAlertEnv, loadPlatformEmailEnv } from '@commerce/config'
import { platformEmailFromEnv } from '@commerce/core/platform-email'

async function readState(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8')
  } catch {
    return null
  }
}

/**
 * Emails each recipient; logs instead when no recipient or no platform email is set up.
 * False when an email was due but none went out, so the next attempt tries again.
 */
async function send(message: BackupAlertMessage): Promise<boolean> {
  const env = loadBackupAlertEnv(process.env)
  const where = env.BACKUP_LOCAL_DIR
    ? `local folder ${env.BACKUP_LOCAL_DIR}`
    : `R2 bucket ${env.BACKUP_R2_BUCKET ?? '(not set)'}`
  const { subject, text } = backupAlertEmail(message, where)
  console.log(`backup-alert: ${subject}`)
  const to = env.BACKUP_ALERT_EMAIL.length > 0 ? env.BACKUP_ALERT_EMAIL : env.PLATFORM_ADMIN_EMAILS
  if (to.length === 0) {
    console.error('backup-alert: no BACKUP_ALERT_EMAIL or PLATFORM_ADMIN_EMAILS, not emailed')
    return true
  }
  const transport = platformEmailFromEnv(loadPlatformEmailEnv(process.env)).transport
  const channel = transport?.channel({
    fromEmail: transport.fromEmail,
    fromName: transport.fromName,
    replyTo: undefined,
    using: 'platform',
  })
  if (!channel?.sendMarketing) {
    console.error('backup-alert: platform email is not set up (SENDER_EMAIL_PROVIDER), not emailed')
    return true
  }
  const html = `<pre style="white-space:pre-wrap;font-family:sans-serif">${text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')}</pre>`
  let delivered = false
  for (const email of to) {
    const r = await channel.sendMarketing({ kind: 'email', to: { email }, subject, html, text })
    console.log(`backup-alert: ${r.ok ? 'emailed' : `could not email (${r.error})`} ${email}`)
    delivered ||= r.ok
  }
  return delivered
}

/** `send`, but a thrown error (bad env, network) is logged and counts as not sent. */
async function trySend(message: BackupAlertMessage): Promise<boolean> {
  try {
    return await send(message)
  } catch (err) {
    console.error(`backup-alert: could not email: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

async function main() {
  const [command, code] = process.argv.slice(2)
  const now = new Date()
  const file = loadBackupAlertEnv(process.env).BACKUP_ALERT_STATE_FILE
  const state = parseAlertState(await readState(file), now)
  let step: ReturnType<typeof checkStale>
  if (command === 'attempt' && code !== undefined && /^\d+$/.test(code)) {
    step = recordAttempt(state, Number(code), now)
  } else if (command === 'check') {
    step = checkStale(state, now)
  } else {
    console.error('usage: backup-alert.ts attempt <exit code> | check')
    return
  }
  let next = step.state
  // A "failing" email that did not go out is not counted, so the next attempt or check retries it.
  if (step.send?.kind === 'failing' && !(await trySend(step.send))) {
    next = { ...step.state, alertedNight: state.alertedNight }
  } else if (step.send?.kind === 'recovered') {
    await trySend(step.send)
  }
  await writeFile(file, JSON.stringify(next))
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(`backup-alert: ${err instanceof Error ? err.message : err}`)
  })
}
