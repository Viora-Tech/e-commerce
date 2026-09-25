/**
 * Key naming and retention selection for backups uploaded to R2 (or written to
 * a local folder). `scripts/backup-db.ts` does the actual pg_dump/tar and S3
 * or filesystem calls, this module only decides object keys and what to keep.
 */
export type BackupKind = 'daily' | 'weekly'

/** `postgres`: the `pg_dump` gzip. `uploads`: the local storage provider's folder, tarred and gzipped. */
export type BackupDataset = 'postgres' | 'uploads'

export type BackupObject = { key: string; dataset: BackupDataset; kind: BackupKind; date: Date }

const EXTENSION: Record<BackupDataset, string> = { postgres: 'dump.gz', uploads: 'tar.gz' }

function stamp(date: Date): string {
  // 2026-09-24T03-15-00Z: colon-free, so it's a safe S3 key and still sorts lexicographically.
  return `${date
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\.\d{3}Z$/, 'Z')}`
}

/** Object key a backup of `kind` taken at `date` is uploaded under. Defaults to the `postgres` dataset. */
export function backupKey(
  date: Date,
  kind: BackupKind,
  dataset: BackupDataset = 'postgres',
): string {
  return `${dataset}/${kind}/${stamp(date)}.${EXTENSION[dataset]}`
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
  const m = key.match(/^(postgres|uploads)\/(daily|weekly)\/(.+)\.(dump|tar)\.gz$/)
  if (!m) return null
  const [, dataset, kind, rawStamp] = m as [string, BackupDataset, BackupKind, string]
  // Reverse the colon substitution made in stamp() so Date can parse it.
  const iso = rawStamp.replace(/^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})Z$/, '$1:$2:$3Z')
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return { key, dataset, kind, date }
}

export type RetentionOptions = { keepDaily?: number; keepWeekly?: number }

/**
 * Given every backup object currently in the bucket (any mix of datasets),
 * returns the keys to delete: everything beyond the newest `keepDaily` daily
 * backups and the newest `keepWeekly` weekly backups, per dataset — so
 * pruning the `uploads` backups never counts against `postgres`'s retention
 * or the other way round. Defaults: 7 daily, 4 weekly.
 */
export function selectKeysToDelete(
  objects: BackupObject[],
  { keepDaily = 7, keepWeekly = 4 }: RetentionOptions = {},
): string[] {
  const datasets = [...new Set(objects.map((o) => o.dataset))]
  const byKindOf = (dataset: BackupDataset, kind: BackupKind) =>
    objects
      .filter((o) => o.dataset === dataset && o.kind === kind)
      .sort((a, b) => b.date.getTime() - a.date.getTime())

  return datasets
    .flatMap((dataset) => [
      ...byKindOf(dataset, 'daily').slice(keepDaily),
      ...byKindOf(dataset, 'weekly').slice(keepWeekly),
    ])
    .map((o) => o.key)
}
