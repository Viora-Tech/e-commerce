/**
 * SQL twins of the day / hour bucketing in `dashboard-buckets.ts` and `analytics-buckets.ts`,
 * so Home and Analytics group orders in Postgres and read back a few rows per bucket instead of
 * every order. Each expression gives the same bucket the JS helper gives for the same instant:
 * IST is a fixed +05:30 with no DST, and the bounds are whole milliseconds, so microsecond
 * timestamps never land in a different bucket than their millisecond Date.
 */
import { type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * A JS instant as a `timestamptz` literal. Inlined, not a parameter: a bucket expression is
 * both selected and grouped by, and Postgres only accepts that when the two are the same text
 * (drizzle numbers every parameter on its own, `$1` and `$2`). `toISOString()` is only digits,
 * `-`, `:`, `.`, `T` and `Z`, so the literal is safe.
 */
export function ts(at: Date): SQL {
  const iso = at.toISOString()
  if (!/^[\dTZ:.+-]+$/.test(iso)) throw new Error(`not an instant: ${iso}`)
  return sql.raw(`'${iso}'::timestamptz`)
}

/** A whole number inlined as SQL text, for the same reason as `ts`. */
export function int(n: number): SQL {
  if (!Number.isInteger(n)) throw new Error(`not an integer: ${n}`)
  return sql.raw(String(n))
}

/** Whole `unitMs` steps from `from` to `col`, like `Math.floor((at - from) / unitMs)`. */
export function stepIndex(col: AnyPgColumn | SQL, from: Date, unitMs: number): SQL<number> {
  return sql<number>`floor(extract(epoch from (${col} - ${ts(from)})) * 1000 / ${int(unitMs)})::int`
}

/** Hour of the day (0-23) in IST, like `istHour`. */
export function istHourSql(col: AnyPgColumn | SQL): SQL<number> {
  return sql<number>`extract(hour from ${col} at time zone 'Asia/Kolkata')::int`
}

/** Day of the week in IST (0 = Sunday), like `istWeekday`. */
export function istWeekdaySql(col: AnyPgColumn | SQL): SQL<number> {
  return sql<number>`extract(dow from ${col} at time zone 'Asia/Kolkata')::int`
}

/** The IST calendar day `YYYY-MM-DD`, like `dayKey` / `istIsoDate`. */
export function istDaySql(col: AnyPgColumn | SQL): SQL<string> {
  return sql<string>`to_char(${col} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`
}

/** `sum(...)` as a JS number, 0 for no rows. */
export function sumInt(expr: AnyPgColumn | SQL): SQL<number> {
  return sql<number>`coalesce(sum(${expr}), 0)::bigint`.mapWith(Number)
}

/** `count(*) filter (where ...)` as a JS number. */
export function countWhere(cond: SQL | undefined): SQL<number> {
  return cond
    ? sql<number>`count(*) filter (where ${cond})::int`.mapWith(Number)
    : sql<number>`count(*)::int`.mapWith(Number)
}

/** `sum(expr) filter (where ...)` as a JS number, 0 for none. */
export function sumWhere(expr: AnyPgColumn | SQL, cond: SQL): SQL<number> {
  return sql<number>`coalesce(sum(${expr}) filter (where ${cond}), 0)::bigint`.mapWith(Number)
}
