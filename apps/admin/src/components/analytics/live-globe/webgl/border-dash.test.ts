import { describe, expect, it } from 'vitest'
import { DASH_DUTY_CYCLE, DASH_PERIOD_CSS_PX, isDashVisible } from './border-dash'

describe('isDashVisible', () => {
  it('is visible right at the start of every period (arc length 0)', () => {
    expect(isDashVisible(0, 500)).toBe(true)
  })

  it('turns off partway through each period and back on at the next one', () => {
    const radiusPx = 500
    // One full period, in radians of arc length, at this radius.
    const periodRadians = DASH_PERIOD_CSS_PX / radiusPx
    expect(isDashVisible(periodRadians * 0.1, radiusPx)).toBe(true)
    expect(isDashVisible(periodRadians * (DASH_DUTY_CYCLE - 0.01), radiusPx)).toBe(true)
    expect(isDashVisible(periodRadians * (DASH_DUTY_CYCLE + 0.01), radiusPx)).toBe(false)
    expect(isDashVisible(periodRadians * 0.99, radiusPx)).toBe(false)
    // Wraps to the next period's "on" stretch.
    expect(isDashVisible(periodRadians * 1.1, radiusPx)).toBe(true)
  })

  it('keeps the same on-screen dash length at any zoom (radius)', () => {
    // Same arc length, different radii: a bigger radius maps more screen px to the same real
    // distance, so it takes fewer periods' worth of arc length to reach the same screen
    // position — the visibility pattern still lines up when both are scaled consistently.
    for (const radiusPx of [100, 250, 600, 1400]) {
      const period = DASH_PERIOD_CSS_PX / radiusPx
      // A tenth of the way into a period is always "on", regardless of radius.
      expect(isDashVisible(period * 0.1, radiusPx)).toBe(true)
    }
  })

  it('gives a short ~2.5-3 px dash with a ~2 px gap at a 5 px period', () => {
    const radiusPx = 1
    const onLengthPx = DASH_DUTY_CYCLE * DASH_PERIOD_CSS_PX
    const offLengthPx = (1 - DASH_DUTY_CYCLE) * DASH_PERIOD_CSS_PX
    expect(onLengthPx).toBeGreaterThanOrEqual(2.5)
    expect(onLengthPx).toBeLessThanOrEqual(3)
    expect(offLengthPx).toBeGreaterThanOrEqual(2)
    expect(offLengthPx).toBeLessThanOrEqual(2.5)
    // Sanity-check against the actual function at a few points along one period.
    for (let px = 0; px < DASH_PERIOD_CSS_PX; px += 0.5) {
      expect(isDashVisible(px, radiusPx)).toBe(px <= onLengthPx)
    }
  })

  it('accepts a custom dash period', () => {
    expect(isDashVisible(0.001, 200, 4)).toBe(
      (0.001 * 200) / 4 - Math.floor((0.001 * 200) / 4) <= DASH_DUTY_CYCLE,
    )
  })
})
