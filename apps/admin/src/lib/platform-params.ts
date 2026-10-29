/** Search params of the platform console's list pages (`/platform/...?q=&page=`). */

type Param = string | string[] | undefined

const DAY_MS = 86_400_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** One search param as a trimmed string; undefined when absent or blank. */
export function textParam(value: Param): string | undefined {
  const v = (Array.isArray(value) ? value[0] : value)?.trim()
  return v ? v : undefined
}

/** `?page=` as a whole number from 1; anything else is page 1. */
export function pageParam(value: Param): number {
  const n = Number(textParam(value))
  return Number.isInteger(n) && n >= 1 ? n : 1
}

/** `?x=` when it is one of `allowed`, else undefined. */
export function oneOf<T extends string>(value: Param, allowed: readonly T[]): T | undefined {
  const v = textParam(value)
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined
}

/** A `YYYY-MM-DD` param as midnight IST of that day, plus `plusDays` (1 for an exclusive end). */
export function dayParam(value: Param, plusDays = 0): Date | undefined {
  const v = textParam(value)
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined
  const d = new Date(`${v}T00:00:00+05:30`)
  if (Number.isNaN(d.getTime())) return undefined
  return new Date(d.getTime() + plusDays * DAY_MS)
}

/** A UUID param, or undefined. */
export function uuidParam(value: Param): string | undefined {
  const v = textParam(value)
  return v && UUID_RE.test(v) ? v : undefined
}

/** `base?k=v&…` with the empty values (and page 1) left out. */
export function platformHref(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const query = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && !(k === 'page' && v === 1)) query.set(k, String(v))
  }
  const s = query.toString()
  return s ? `${base}?${s}` : base
}
