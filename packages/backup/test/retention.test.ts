import { describe, expect, it } from 'vitest'
import {
  type BackupObject,
  backupKey,
  kindsForDate,
  parseBackupKey,
  selectKeysToDelete,
} from '../src/retention'

describe('backupKey / parseBackupKey', () => {
  it('round-trips a date and kind through the key', () => {
    const date = new Date('2026-09-24T03:15:07.123Z')
    const key = backupKey(date, 'daily')
    expect(key).toBe('postgres/daily/2026-09-24T03-15-07Z.dump.gz')

    const parsed = parseBackupKey(key)
    expect(parsed?.kind).toBe('daily')
    expect(parsed?.date.toISOString()).toBe('2026-09-24T03:15:07.000Z')
  })

  it('returns null for a key it did not produce', () => {
    expect(parseBackupKey('postgres/monthly/2026-09-24T03-15-07Z.dump.gz')).toBeNull()
    expect(parseBackupKey('media/logo.png')).toBeNull()
  })

  it('round-trips the uploads dataset with its own extension', () => {
    const date = new Date('2026-09-24T03:15:07.123Z')
    const key = backupKey(date, 'daily', 'uploads')
    expect(key).toBe('uploads/daily/2026-09-24T03-15-07Z.tar.gz')

    const parsed = parseBackupKey(key)
    expect(parsed?.dataset).toBe('uploads')
    expect(parsed?.kind).toBe('daily')
  })
})

describe('kindsForDate', () => {
  it('is daily-only on a weekday', () => {
    expect(kindsForDate(new Date('2026-09-24T03:00:00Z'))).toEqual(['daily']) // Thursday
  })

  it('is also weekly on Monday (UTC)', () => {
    expect(kindsForDate(new Date('2026-09-21T03:00:00Z'))).toEqual(['daily', 'weekly'])
  })
})

describe('selectKeysToDelete', () => {
  function dailyObjects(
    count: number,
    dataset: BackupObject['dataset'] = 'postgres',
  ): BackupObject[] {
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(Date.UTC(2026, 8, 30 - i))
      return { key: `${dataset}/daily/day-${i}`, dataset, kind: 'daily' as const, date }
    })
  }

  function weeklyObjects(
    count: number,
    dataset: BackupObject['dataset'] = 'postgres',
  ): BackupObject[] {
    return Array.from({ length: count }, (_, i) => {
      const date = new Date(Date.UTC(2026, 8, 30 - i * 7))
      return { key: `${dataset}/weekly/week-${i}`, dataset, kind: 'weekly' as const, date }
    })
  }

  it('keeps the newest 7 daily and deletes the rest', () => {
    const objects = dailyObjects(10)
    const toDelete = selectKeysToDelete(objects)
    expect(toDelete).toHaveLength(3)
    expect(toDelete).toEqual([
      'postgres/daily/day-7',
      'postgres/daily/day-8',
      'postgres/daily/day-9',
    ])
  })

  it('keeps the newest 4 weekly and deletes the rest, independently of daily', () => {
    const objects = [...dailyObjects(5), ...weeklyObjects(6)]
    const toDelete = selectKeysToDelete(objects)
    expect(toDelete).toEqual(['postgres/weekly/week-4', 'postgres/weekly/week-5'])
  })

  it('deletes nothing when under the retention count', () => {
    expect(selectKeysToDelete(dailyObjects(3))).toEqual([])
  })

  it('respects custom retention counts', () => {
    const objects = dailyObjects(5)
    expect(selectKeysToDelete(objects, { keepDaily: 2 })).toHaveLength(3)
  })

  it('is a no-op on an empty bucket', () => {
    expect(selectKeysToDelete([])).toEqual([])
  })

  it('prunes each dataset independently, so uploads retention never eats into postgres', () => {
    const objects = [...dailyObjects(10, 'postgres'), ...dailyObjects(3, 'uploads')]
    const toDelete = selectKeysToDelete(objects)
    expect(toDelete).toEqual([
      'postgres/daily/day-7',
      'postgres/daily/day-8',
      'postgres/daily/day-9',
    ])
  })
})
