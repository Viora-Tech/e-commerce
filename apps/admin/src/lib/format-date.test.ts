import { describe, expect, it } from 'vitest'
import { dayKey, formatDate, formatDateTime, formatDay, formatWhen } from './format-date'

describe('format-date timezone pinning', () => {
  // Every assertion pins IST explicitly, so the runtime's own default timezone (whatever the
  // test process happens to run under) must not change the result — that mismatch between a
  // server process and a browser is exactly what produced the Domains page hydration error.
  it('formats in IST regardless of the process timezone', () => {
    const at = new Date('2026-01-15T12:00:00.000Z') // 17:30 IST
    expect(formatDateTime(at)).toContain('5:30 pm')
    expect(formatDateTime(at)).toContain('15 Jan 2026')
    expect(formatDate(at)).toBe('15 Jan 2026')
  })

  it('rolls a day over at the IST boundary, not the local one', () => {
    // 18:31 UTC on 15 Jan is already 00:01 IST on 16 Jan.
    const lateUtc = new Date('2026-01-15T18:31:00.000Z')
    const now = new Date('2026-01-16T00:05:00.000Z') // 05:35 IST, same IST day as lateUtc
    expect(formatWhen(lateUtc, now)).toMatch(/^Today,/)
    expect(formatDay(lateUtc, now)).toBe('Today')
  })

  it('groups by IST calendar day', () => {
    const justBeforeMidnightIst = new Date('2026-01-15T18:29:00.000Z') // 23:59 IST on 15 Jan
    const justAfterMidnightIst = new Date('2026-01-15T18:31:00.000Z') // 00:01 IST on 16 Jan
    expect(dayKey(justBeforeMidnightIst)).not.toBe(dayKey(justAfterMidnightIst))
  })
})
