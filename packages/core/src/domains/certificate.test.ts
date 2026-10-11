/** SOURCE OF TRUTH: certificate schedule tests — WHAT: retry intervals, when a row is due, reasons / WHY: the backoff must stay inside Let's Encrypt's limits and stop after three days */
import { describe, expect, it } from 'vitest'
import { CERT_REASON, CERT_RETRY_WINDOW_MS, certCheckDue, DAY, reasonOf } from './certificate'

const MIN = 60_000
const HOUR = 60 * MIN
const t0 = new Date('2026-10-11T10:00:00Z')
const ago = (ms: number) => new Date(t0.getTime() - ms)

describe('backoff', () => {
  const row = (waitedMs: number, lastCheckMs: number) => ({
    sslStatus: 'issuing',
    sslStartedAt: ago(waitedMs),
    sslCheckedAt: ago(lastCheckMs),
    createdAt: ago(10 * DAY),
  })
  const dueAfter = (waitedMs: number, intervalMs: number) => [
    certCheckDue(row(waitedMs, intervalMs - 1), t0),
    certCheckDue(row(waitedMs, intervalMs), t0),
  ]

  it('backs off from a minute to six hours', () => {
    expect(dueAfter(4 * MIN, MIN)).toEqual([false, true])
    expect(dueAfter(5 * MIN, 5 * MIN)).toEqual([false, true])
    expect(dueAfter(30 * MIN, 15 * MIN)).toEqual([false, true])
    expect(dueAfter(2 * HOUR, HOUR)).toEqual([false, true])
    expect(dueAfter(6 * HOUR, 6 * HOUR)).toEqual([false, true])
    expect(dueAfter(2 * DAY, 6 * HOUR)).toEqual([false, true])
  })

  it('stops after three days', () => {
    expect(certCheckDue(row(CERT_RETRY_WINDOW_MS - 1, 7 * HOUR), t0)).toBe(true)
    expect(certCheckDue(row(CERT_RETRY_WINDOW_MS, 7 * HOUR), t0)).toBe(false)
  })
})

describe('certCheckDue', () => {
  const row = (over: object = {}) => ({
    sslStatus: 'issuing',
    sslStartedAt: ago(10 * MIN),
    sslCheckedAt: null as Date | null,
    createdAt: ago(DAY),
    ...over,
  })

  it('checks a waiting row that was never checked', () => {
    expect(certCheckDue(row(), t0)).toBe(true)
  })

  it('waits the interval for its age (5 minutes at 10 minutes in)', () => {
    expect(certCheckDue(row({ sslCheckedAt: ago(4 * MIN) }), t0)).toBe(false)
    expect(certCheckDue(row({ sslCheckedAt: ago(5 * MIN) }), t0)).toBe(true)
  })

  it('counts from creation when the wait has no start', () => {
    expect(certCheckDue(row({ sslStartedAt: null, createdAt: ago(4 * DAY) }), t0)).toBe(false)
  })

  it('leaves a row alone after the retry window', () => {
    expect(certCheckDue(row({ sslStartedAt: ago(CERT_RETRY_WINDOW_MS + MIN) }), t0)).toBe(false)
  })

  it('re-checks an active row once a day, and one never checked', () => {
    const active = { sslStatus: 'active', sslStartedAt: null, createdAt: ago(9 * DAY) }
    expect(certCheckDue({ ...active, sslCheckedAt: null }, t0)).toBe(true)
    expect(certCheckDue({ ...active, sslCheckedAt: ago(HOUR) }, t0)).toBe(false)
    expect(certCheckDue({ ...active, sslCheckedAt: ago(DAY) }, t0)).toBe(true)
  })
})

describe('reasonOf', () => {
  it('maps the stored text to a reason, anything else to the certificate', () => {
    expect(reasonOf(CERT_REASON.dns)).toBe('dns')
    expect(reasonOf(CERT_REASON.certificate)).toBe('certificate')
    expect(reasonOf(null)).toBe('certificate')
  })
})
