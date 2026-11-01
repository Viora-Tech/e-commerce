'use client'

import { DEFAULT_TIME_ZONE, wallClock, zoneOffsetMs } from '@commerce/dates'
import DateField from '@/components/fields/date-field'

type DateTimeInputProps = {
  id: string
  value: unknown
  invalid?: boolean | undefined
  onChange: (value: string | null) => void
}

/** A saved instant as the store clock's `yyyy-mm-ddThh:mm`, what `datetime-local` shows. */
function toWallTime(value: unknown): string {
  if (typeof value !== 'string') return ''
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return ''
  return wallClock(at, DEFAULT_TIME_ZONE).toISOString().slice(0, 16)
}

/** The store clock's `yyyy-mm-ddThh:mm` as an instant in UTC; null when blank or unfinished. */
function fromWallTime(text: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null
  const asUtc = new Date(`${text}:00.000Z`)
  if (Number.isNaN(asUtc.getTime())) return null
  return new Date(asUtc.getTime() - zoneOffsetMs(asUtc, DEFAULT_TIME_ZONE)).toISOString()
}

/**
 * A day and a time in one native picker (calendar and clock on phones). The admin reads
 * times in the store's zone, like every other date in it.
 */
export default function DateTimeInput({ id, value, invalid, onChange }: DateTimeInputProps) {
  // Render logic
  return (
    <DateField
      mode="datetime"
      id={id}
      value={toWallTime(value)}
      aria-invalid={invalid || undefined}
      onChange={(v) => onChange(fromWallTime(v))}
      className="sm:max-w-80"
    />
  )
}
