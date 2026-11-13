import { describe, expect, it } from 'vitest'
import {
  type BackupAlertState,
  backupAlertEmail,
  checkStale,
  initialAlertState,
  parseAlertState,
  recordAttempt,
} from '../src/alert'

const at = (iso: string) => new Date(iso)

/** Runs attempts in order, collecting every message sent. */
function run(start: BackupAlertState, attempts: [string, number][]) {
  let state = start
  const sent: string[] = []
  for (const [iso, code] of attempts) {
    const step = recordAttempt(state, code, at(iso))
    state = step.state
    if (step.send) sent.push(step.send.kind)
  }
  return { state, sent }
}

const goodLastNight = recordAttempt(
  initialAlertState(at('2026-11-10T20:00:00Z')),
  0,
  at('2026-11-11T21:00:00Z'),
).state

describe('recordAttempt', () => {
  it('sends nothing for one or two failures', () => {
    const { sent, state } = run(goodLastNight, [
      ['2026-11-12T21:00:00Z', 137],
      ['2026-11-12T21:05:00Z', 137],
    ])
    expect(sent).toEqual([])
    expect(state.failuresTonight).toBe(2)
  })

  it('sends one alert on the third failure in a night, not one per retry', () => {
    const attempts: [string, number][] = Array.from({ length: 12 }, (_, i) => [
      `2026-11-12T21:${String(i * 5).padStart(2, '0')}:00Z`,
      137,
    ])
    const { sent, state } = run(goodLastNight, attempts)
    expect(sent).toEqual(['failing'])
    expect(state.failuresTonight).toBe(12)
    expect(state.alertOpen).toBe(true)
  })

  it('sends again the next night while it keeps failing, once', () => {
    const night = (day: string): [string, number][] =>
      [0, 5, 10, 15].map((m) => [`2026-11-${day}T21:${String(m).padStart(2, '0')}:00Z`, 137])
    const { sent, state } = run(goodLastNight, [...night('12'), ...night('13')])
    expect(sent).toEqual(['failing', 'failing'])
    expect(state.failuresInRow).toBe(8)
  })

  it('counts failures per night: two one night and one the next is not three tonight', () => {
    const start = { ...goodLastNight, lastSuccessAt: '2026-11-12T20:00:00.000Z' }
    const { sent } = run(start, [
      ['2026-11-12T21:00:00Z', 1],
      ['2026-11-12T21:05:00Z', 1],
      ['2026-11-12T21:10:00Z', 0],
    ])
    expect(sent).toEqual([])
  })

  it('sends "recovered" on the first success after an alert, and only then', () => {
    const { sent, state } = run(goodLastNight, [
      ['2026-11-12T21:00:00Z', 137],
      ['2026-11-12T21:05:00Z', 137],
      ['2026-11-12T21:10:00Z', 137],
      ['2026-11-12T21:15:00Z', 0],
      ['2026-11-13T21:00:00Z', 0],
    ])
    expect(sent).toEqual(['failing', 'recovered'])
    expect(state.alertOpen).toBe(false)
    expect(state.failuresInRow).toBe(0)
  })

  it('does not send "recovered" after failures that never alerted', () => {
    const { sent } = run(goodLastNight, [
      ['2026-11-12T21:00:00Z', 1],
      ['2026-11-12T21:05:00Z', 0],
    ])
    expect(sent).toEqual([])
  })
})

describe('checkStale', () => {
  it('stays quiet within 26 hours of the last good backup', () => {
    expect(checkStale(goodLastNight, at('2026-11-12T22:59:00Z')).send).toBeNull()
  })

  it('alerts once past 26 hours, then not again the same night', () => {
    const first = checkStale(goodLastNight, at('2026-11-12T23:00:00Z'))
    expect(first.send).toMatchObject({ kind: 'failing', reason: 'stale' })
    expect(checkStale(first.state, at('2026-11-12T23:59:00Z')).send).toBeNull()
    // A failed attempt later that night does not send a second one either.
    expect(recordAttempt(first.state, 1, at('2026-11-12T23:30:00Z')).send).toBeNull()
  })

  it('counts from when watching began when there has never been a success', () => {
    const fresh = initialAlertState(at('2026-11-12T00:00:00Z'))
    expect(checkStale(fresh, at('2026-11-12T20:00:00Z')).send).toBeNull()
    expect(checkStale(fresh, at('2026-11-13T02:00:00Z')).send?.kind).toBe('failing')
  })

  it('never fires on attempt counts alone', () => {
    const { state } = run(goodLastNight, [
      ['2026-11-12T21:00:00Z', 1],
      ['2026-11-12T21:05:00Z', 1],
    ])
    expect(checkStale(state, at('2026-11-12T21:30:00Z')).send).toBeNull()
  })
})

describe('parseAlertState', () => {
  it('starts fresh from nothing or garbage', () => {
    const now = at('2026-11-12T00:00:00Z')
    expect(parseAlertState(null, now)).toEqual(initialAlertState(now))
    expect(parseAlertState('{not json', now)).toEqual(initialAlertState(now))
    expect(parseAlertState('{"failuresInRow":3}', now)).toEqual(initialAlertState(now))
  })

  it('round-trips a saved state', () => {
    const { state } = run(goodLastNight, [
      ['2026-11-12T21:00:00Z', 137],
      ['2026-11-12T21:05:00Z', 137],
      ['2026-11-12T21:10:00Z', 137],
    ])
    expect(parseAlertState(JSON.stringify(state), at('2026-11-14T00:00:00Z'))).toEqual(state)
  })
})

describe('backupAlertEmail', () => {
  it('names the kill and the last good backup', () => {
    const { send } = recordAttempt(goodLastNight, 137, at('2026-11-12T21:00:00Z'), {
      failures: 1,
    })
    if (!send) throw new Error('expected an alert')
    const { subject, text } = backupAlertEmail(send, 'R2 bucket backups')
    expect(subject).toMatch(/Backup failing/)
    expect(text).toContain('killed, most likely out of memory')
    expect(text).toContain('2026-11-11T21:00:00.000Z')
    expect(text).toContain('R2 bucket backups')
  })

  it('writes a recovered message', () => {
    const { subject } = backupAlertEmail(
      { kind: 'recovered', at: '2026-11-13T21:00:00.000Z', failuresInRow: 5 },
      'R2 bucket backups',
    )
    expect(subject).toMatch(/recovered/i)
  })
})
