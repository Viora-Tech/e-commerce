/**
 * The Home analytics card's date ranges (Figma 580:692, "Today ▾"): the presets on the left of
 * the picker and how each turns into an IST from–to pair. Pure, so the server can render the
 * first range and the picker can recompute on the client.
 */
export const RANGE_PRESETS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'thisFy',
  'diwali',
  'festive',
  'custom',
] as const

export type RangePreset = (typeof RANGE_PRESETS)[number]

/** What the dashed line compares against (the API's `compare`). */
export type RangeCompare = 'previous' | 'year' | 'none'

export type HomeRange = { preset: RangePreset; from: string; to: string }

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const DAY_MS = 86_400_000

/** Diwali (Lakshmi Puja) by year; the "Diwali week" preset is the three days either side. */
const DIWALI: Record<number, string> = {
  2024: '2024-11-01',
  2025: '2025-10-20',
  2026: '2026-11-08',
  2027: '2027-10-29',
  2028: '2028-10-17',
  2029: '2029-11-05',
  2030: '2030-10-26',
}

/** Today's date in India as YYYY-MM-DD. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** An ISO date moved by whole days. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `from` to `to`, both counted. */
export function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
}

function earlier(a: string, b: string): string {
  return a < b ? a : b
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** A preset as dates, ending no later than today. `custom` keeps the last range. */
export function presetRange(preset: RangePreset, now = new Date()): { from: string; to: string } {
  const today = istToday(now)
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  switch (preset) {
    case 'yesterday': {
      const day = addDays(today, -1)
      return { from: day, to: day }
    }
    case '7d':
      return { from: addDays(today, -6), to: today }
    case '30d':
      return { from: addDays(today, -29), to: today }
    case 'thisMonth':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'lastMonth': {
      const firstThis = `${today.slice(0, 7)}-01`
      const lastPrev = addDays(firstThis, -1)
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev }
    }
    case 'thisQuarter': {
      const startMonth = Math.floor((month - 1) / 3) * 3 + 1
      return { from: `${year}-${pad(startMonth)}-01`, to: today }
    }
    case 'thisFy': {
      /* India's financial year starts on 1 April. */
      const fyYear = month >= 4 ? year : year - 1
      return { from: `${fyYear}-04-01`, to: today }
    }
    case 'diwali': {
      const thisYear = DIWALI[year]
      const day = thisYear && thisYear <= today ? thisYear : (DIWALI[year - 1] ?? thisYear ?? today)
      return { from: addDays(day, -3), to: earlier(addDays(day, 3), today) }
    }
    case 'festive': {
      /* September to November, this year once it has begun, else last year's. */
      const festiveYear = today >= `${year}-09-01` ? year : year - 1
      return { from: `${festiveYear}-09-01`, to: earlier(`${festiveYear}-11-30`, today) }
    }
    default:
      return { from: today, to: today }
  }
}

export function rangeFor(preset: RangePreset, now = new Date()): HomeRange {
  return { preset, ...presetRange(preset, now) }
}
