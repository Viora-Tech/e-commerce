import { describe, expect, it } from 'vitest'
import { FAILS_BEFORE_DOWN, FRESH, nextState } from './checks'

const NOW = '2026-10-18T12:00:00.000Z'

describe('nextState', () => {
  it('says nothing while a check keeps answering', () => {
    expect(nextState(FRESH, true, '', NOW)).toEqual({ state: FRESH, event: null })
  })

  it('reports down only after the misses in a row, and only once', () => {
    let state = FRESH
    const events: Array<string | null> = []
    for (let i = 0; i < FAILS_BEFORE_DOWN + 2; i++) {
      const next = nextState(state, false, 'HTTP 502', NOW)
      state = next.state
      events.push(next.event)
    }
    expect(events.filter((e) => e === 'down')).toHaveLength(1)
    expect(events[FAILS_BEFORE_DOWN - 1]).toBe('down')
    expect(state).toMatchObject({ down: true, since: NOW, detail: 'HTTP 502' })
  })

  it('one slow answer then a good one is not an alert', () => {
    const missed = nextState(FRESH, false, 'no answer in 10s', NOW)
    expect(missed.event).toBeNull()
    expect(nextState(missed.state, true, '', NOW)).toEqual({ state: FRESH, event: null })
  })

  it('reports up once when a down check answers again', () => {
    const down = { fails: 3, down: true, since: NOW, detail: 'HTTP 502' }
    expect(nextState(down, true, '', NOW)).toEqual({ state: FRESH, event: 'up' })
  })
})
