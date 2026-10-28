import { createParser } from 'nuqs'
import { DATE_CUSTOM, type DateFilterValue } from '@/components/table/filter-panel'

/** No date filter. Module scope, so the URL default keeps one identity. */
export const NO_DATE_FILTER: DateFilterValue = { preset: null, from: '', to: '' }

const CUSTOM_PARAM = /^custom:(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/

/**
 * A date filter in the URL: a preset key (`7d`), or `custom:2026-10-01..2026-10-28` where either
 * end may be empty. Anything else reads as no filter.
 */
export function parseAsDateFilter(presets: readonly string[]) {
  return createParser<DateFilterValue>({
    parse: (v) => {
      if (presets.includes(v)) return { preset: v, from: '', to: '' }
      const m = CUSTOM_PARAM.exec(v)
      return m ? { preset: DATE_CUSTOM, from: m[1] ?? '', to: m[2] ?? '' } : null
    },
    serialize: (d) =>
      d.preset && d.preset !== DATE_CUSTOM ? d.preset : `${DATE_CUSTOM}:${d.from}..${d.to}`,
    eq: (a, b) => a.preset === b.preset && a.from === b.from && a.to === b.to,
  }).withDefault(NO_DATE_FILTER)
}

/** True when the value filters anything (a preset, or a custom range with an end). */
export function hasDateFilter(d: DateFilterValue): boolean {
  return d.preset !== null && (d.preset !== DATE_CUSTOM || d.from !== '' || d.to !== '')
}

/** Midnight at the start of a yyyy-mm-dd day in the browser's time (the merchant's day). */
function startOfDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/**
 * The filter as an API window, as ISO times: a preset's start (from `presetStart`) up to now, or
 * a custom range from the start of its first day to the end of its last day (either open).
 */
export function dateFilterBounds(
  d: DateFilterValue,
  presetStart: (preset: string, now: Date) => Date | null,
  now = new Date(),
): { from?: string; to?: string } {
  if (!hasDateFilter(d) || d.preset === null) return {}
  if (d.preset !== DATE_CUSTOM) {
    const start = presetStart(d.preset, now)
    return start ? { from: start.toISOString() } : {}
  }
  const out: { from?: string; to?: string } = {}
  if (d.from) out.from = startOfDay(d.from).toISOString()
  if (d.to) {
    const end = startOfDay(d.to)
    end.setDate(end.getDate() + 1)
    out.to = end.toISOString()
  }
  return out
}
