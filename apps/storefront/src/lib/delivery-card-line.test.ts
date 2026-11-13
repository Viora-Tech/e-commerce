/** SOURCE OF TRUTH: delivery card fact line tests — WHAT: mode, cut-off countdown, prepaid only and COD facts, and which card counts down / WHY: Figma 942:513; a fact we do not know is never shown. */
import { describe, expect, it } from 'vitest'
import { countdownIndex, deliveryCardLine, minutesUntil } from './delivery-card-line'

const base = {
  title: 'Delhivery',
  mode: null,
  codAllowed: null,
  codOffered: true,
  minutesLeft: null,
} as const

describe('deliveryCardLine', () => {
  it('names how the route travels, with the countdown on the counting card', () => {
    expect(deliveryCardLine({ ...base, mode: 'air', minutesLeft: 134 })).toBe(
      'By air · order in the next 2 h 14 min',
    )
    expect(deliveryCardLine({ ...base, mode: 'express', minutesLeft: 45 })).toBe(
      'Express · order in the next 45 min',
    )
  })

  it('says a prepaid-only option is paid online, only when COD is offered here', () => {
    expect(deliveryCardLine({ ...base, title: 'Blue Dart', mode: 'air', codAllowed: false })).toBe(
      'By air · pay online for this option',
    )
    expect(deliveryCardLine({ ...base, mode: 'air', codAllowed: false, codOffered: false })).toBe(
      'By air',
    )
  })

  it('says cash on delivery is available when the option takes it', () => {
    expect(deliveryCardLine({ ...base, mode: 'surface', codAllowed: true })).toBe(
      'Surface · cash on delivery available',
    )
  })

  it('does not repeat a mode the title already names', () => {
    expect(deliveryCardLine({ ...base, title: 'Blue Dart Air', mode: 'air' })).toBeNull()
    expect(deliveryCardLine({ ...base, title: 'Surface', mode: 'surface', codAllowed: true })).toBe(
      'Cash on delivery available',
    )
    expect(deliveryCardLine({ ...base, title: 'Express · Blue Dart', mode: 'air' })).toBe('By air')
  })

  it('shows nothing when nothing is known', () => {
    expect(deliveryCardLine(base)).toBeNull()
  })

  it('keeps the countdown and the prepaid note ahead of COD, three facts at most', () => {
    expect(deliveryCardLine({ ...base, mode: 'air', codAllowed: false, minutesLeft: 60 })).toBe(
      'By air · order in the next 1 h · pay online for this option',
    )
    expect(deliveryCardLine({ ...base, mode: 'surface', codAllowed: true, minutesLeft: 10 })).toBe(
      'Surface · order in the next 10 min · cash on delivery available',
    )
  })
})

describe('minutesUntil', () => {
  const now = Date.parse('2026-11-13T08:00:00.000Z')

  it('counts whole minutes up to the cut-off', () => {
    expect(minutesUntil('2026-11-13T10:14:00.000Z', now)).toBe(134)
    expect(minutesUntil('2026-11-13T08:00:30.000Z', now)).toBe(1)
  })

  it('is null with no cut-off, once it passed, or while it is more than 6 h away', () => {
    expect(minutesUntil(null, now)).toBeNull()
    expect(minutesUntil(undefined, now)).toBeNull()
    expect(minutesUntil('2026-11-13T08:00:00.000Z', now)).toBeNull()
    expect(minutesUntil('2026-11-13T07:00:00.000Z', now)).toBeNull()
    expect(minutesUntil('2026-11-13T14:01:00.000Z', now)).toBeNull()
    expect(minutesUntil('not a date', now)).toBeNull()
  })
})

describe('countdownIndex', () => {
  it('picks the card that arrives first', () => {
    expect(countdownIndex(['2026-11-18', '2026-11-16', '2026-11-17'])).toBe(1)
  })

  it('falls back to the first card on a tie or with no dates', () => {
    expect(countdownIndex(['2026-11-16', '2026-11-16'])).toBe(0)
    expect(countdownIndex([null, null])).toBe(0)
    expect(countdownIndex([])).toBe(0)
  })
})
