/**
 * Key naming and retention selection for Postgres backups uploaded to R2.
 * Pure and dependency-free: `scripts/backup-db.ts` does the actual pg_dump
 * and S3 calls, this module only decides object keys and what to keep.
 */
export type BackupKind = 'daily' | 'weekly'

export type BackupObject = { key: string; kind: BackupKind; date: Date }

const PREFIX = 'postgres'

function stamp(date: Date): string {
  // 2026-09-24T03-15-00Z: colon-free, so it's a safe S3 key and still sorts lexicographically.
  return `${date
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, 'Z')}`
}

/** Object key a backup of `kind` taken at `date` is uploaded under. */
export function backupKey(date: Date, kind: BackupKind): string {
  return `${PREFIX}/${kind}/${stamp(date)}.dump.gz`
}

/**
 * Every kind a given run's backup should be uploaded as. Every run is a
 * daily backup; the first backup of each ISO week (Monday, UTC) is also
 * kept as that week's weekly backup.
 */
export function kindsForDate(date: Date): BackupKind[] {
  const isMonday = date.getUTCDay() === 1
  return isMonday ? ['daily', 'weekly'] : ['daily']
}

/** Reverses `backupKey`; returns null for a key this module didn't produce. */
export function parseBackupKey(key: string): BackupObject | null {
  const m = key.match(/^postgres\/(daily|weekly)\/(.+)\.dump\.gz$/)
  if (!m) return null
  const [, kind, rawStamp] = m as [string, BackupKind, string]
  // Reverse the colon substitution made in stamp() so Date can parse it.
  const iso = rawStamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})Z$/, '$1:$2:$3Z')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return { key, kind, date }
}

export type RetentionOptions = { keepDaily?: number; keepWeekly?: number }

/**
 * Given every backup object currently in the bucket, returns the keys to
 * delete: everything beyond the newest `keepDaily` daily backups and the
 * newest `keepWeekly` weekly backups. Defaults: 7 daily, 4 weekly.
 */
export function selectKeysToDelete(
  objects: BackupObject[],
  { keepDaily = 7, keepWeekly = 4 }: RetentionOptions = {},
): string[] {
  const byKind = (kind: BackupKind) =>
    objects.filter((o) => o.kind === kind).sort((a, b) => b.date.getTime() - a.date.getTime())

  const stale = [...byKind('daily').slice(keepDaily), ...byKind('weekly').slice(keepWeekly)]
  return stale.map((o) => o.key)
}
