import { describe, expect, it, test } from 'vitest'
import { PICKUP_TIMES, pickupDays, pickupRefusal, startingPickupDay } from './pickup-plan'

describe('pickup day cards', () => {
  test('before 2 pm in India today is open', () => {
    // 13:59 IST on 15 Oct.
    const days = pickupDays(new Date('2026-10-15T08:29:00Z'))
    expect(days.map((d) => d.date)).toEqual(['2026-10-15', '2026-10-16', '2026-10-17'])
    expect(days[0]?.pastCutoff).toBe(false)
    expect(startingPickupDay(days, () => false)).toBe('2026-10-15')
  })

  test('from 2 pm in India today is past the cut-off and the drawer starts on tomorrow', () => {
    // 14:00 IST on 15 Oct.
    const days = pickupDays(new Date('2026-10-15T08:30:00Z'))
    expect(days[0]?.pastCutoff).toBe(true)
    expect(days.slice(1).every((d) => !d.pastCutoff)).toBe(true)
    expect(startingPickupDay(days, () => false)).toBe('2026-10-16')
  })

  test('the days are India days, never a past one', () => {
    // 00:10 IST on 16 Oct is still the 15th in UTC.
    const days = pickupDays(new Date('2026-10-15T18:40:00Z'))
    expect(days[0]?.date).toBe('2026-10-16')
    expect(days[0]?.pastCutoff).toBe(false)
  })

  test('a day with a pickup already booked is where the drawer starts', () => {
    const days = pickupDays(new Date('2026-10-15T08:30:00Z'))
    expect(startingPickupDay(days, (d) => d === '2026-10-17')).toBe('2026-10-17')
    // Booked today before the cut-off: joining it is still fine after 2 pm.
    expect(startingPickupDay(days, (d) => d === '2026-10-15')).toBe('2026-10-15')
  })

  test('the third card skips a Sunday', () => {
    // Fri 16 Oct 2026, 10:00 IST: today, Saturday, then Monday.
    const days = pickupDays(new Date('2026-10-16T04:30:00Z'))
    expect(days.map((d) => d.date)).toEqual(['2026-10-16', '2026-10-17', '2026-10-19'])
  })

  test('start times run on the half hour from 09:00 to 19:00', () => {
    expect(PICKUP_TIMES[0]).toBe('09:00')
    expect(PICKUP_TIMES).toContain('14:00')
    expect(PICKUP_TIMES.at(-1)).toBe('19:00')
  })
})

describe('pickupRefusal', () => {
  it('reads the courier’s words off a failed pickup, null when all went through', () => {
    expect(pickupRefusal([{ status: 'scheduled', error: null }], 'generic')).toBeNull()
    expect(
      pickupRefusal(
        [
          { status: 'scheduled', error: null },
          { status: 'failed', error: 'Delhivery did not take the pickup request: no slots' },
        ],
        'generic',
      ),
    ).toBe('Delhivery did not take the pickup request: no slots')
    expect(pickupRefusal([{ status: 'failed', error: ' ' }], 'generic')).toBe('generic')
  })
})
