import { describe, expect, it } from 'vitest'
import { courierTimeToIso } from '../src/courier-time'

describe('courierTimeToIso', () => {
  it('reads a bare date-time as India time, whatever the server clock', () => {
    expect(courierTimeToIso('2026-09-22 08:00:00')).toBe('2026-09-22T02:30:00.000Z')
    expect(courierTimeToIso('2026-09-22T08:00')).toBe('2026-09-22T02:30:00.000Z')
    expect(courierTimeToIso('22-09-2026 08:00:00')).toBe('2026-09-22T02:30:00.000Z')
    expect(courierTimeToIso('22/09/2026 8:05')).toBe('2026-09-22T02:35:00.000Z')
  })

  it('reads a bare date as the start of that day in India', () => {
    expect(courierTimeToIso('2026-09-20')).toBe('2026-09-19T18:30:00.000Z')
    expect(courierTimeToIso('20-09-2026')).toBe('2026-09-19T18:30:00.000Z')
  })

  it('trusts a value that names its own zone', () => {
    expect(courierTimeToIso('2026-09-22T08:00:00Z')).toBe('2026-09-22T08:00:00.000Z')
    expect(courierTimeToIso('2026-09-22T08:00:00+05:30')).toBe('2026-09-22T02:30:00.000Z')
  })

  it('gives null, never a throw, for anything else', () => {
    expect(courierTimeToIso(undefined)).toBeNull()
    expect(courierTimeToIso('')).toBeNull()
    expect(courierTimeToIso('sometime soon')).toBeNull()
    expect(courierTimeToIso('31-02-2026')).toBeNull()
    expect(courierTimeToIso('Mon Sep 22 2026')).toBeNull()
  })
})
