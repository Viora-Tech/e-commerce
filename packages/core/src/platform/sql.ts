/** SOURCE OF TRUTH: platform console SQL helpers — WHAT: parameter and number helpers shared by the console's raw queries / WHY: one encoding for timestamps and counts across overview, stores, users and audit */
import { sql } from 'drizzle-orm'

/** A timestamp parameter, sent as ISO text so the driver never has to encode a Date. */
export const at = (d: Date) => sql`${d.toISOString()}::timestamptz`

/** A count or sum from Postgres (bigint arrives as text) as a number; null is 0. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v))

/** A timestamp column from a raw row as a Date, or null. */
export const date = (v: unknown): Date | null =>
  v === null || v === undefined ? null : new Date(v as string | Date)

/** Rows per page on the console's lists. */
export const PLATFORM_PAGE_SIZE = 25
