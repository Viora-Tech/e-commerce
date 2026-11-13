import { shape, withoutBlanks } from './env'

/**
 * Only what `scripts/backup-alert.ts` reads. Its own pick, so a bad backup setting (the very
 * thing that may be failing the backup) never stops the alert. Blank values count as unset.
 */
export function loadBackupAlertEnv(source: Record<string, string | undefined>) {
  return shape
    .pick({
      BACKUP_ALERT_EMAIL: true,
      BACKUP_ALERT_STATE_FILE: true,
      PLATFORM_ADMIN_EMAILS: true,
      BACKUP_R2_BUCKET: true,
      BACKUP_LOCAL_DIR: true,
    })
    .parse(withoutBlanks(source))
}
