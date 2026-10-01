/** SOURCE OF TRUTH: PIN code to state check tests — states each PIN prefix allows, shared prefixes, the directory override and what is never refused */
import { describe, expect, it } from 'vitest'
import { INDIAN_STATE_NAMES } from '../tax/states'
import { stateMatchesPincode } from './pincode-state'

const STATES = Object.keys(INDIAN_STATE_NAMES)

describe('PIN code to state (D-06)', () => {
  it('accepts the state a PIN code belongs to', () => {
    expect(stateMatchesPincode('110001', 'DL')).toBe(true)
    expect(stateMatchesPincode('560001', 'KA')).toBe(true)
    expect(stateMatchesPincode('400001', 'mh')).toBe(true)
    expect(stateMatchesPincode('122001', 'HR')).toBe(true)
  })

  it('refuses a state that cannot be right', () => {
    expect(stateMatchesPincode('110001', 'MH')).toBe(false)
    expect(stateMatchesPincode('560001', 'TN')).toBe(false)
    expect(stateMatchesPincode('700001', 'KA')).toBe(false)
    expect(stateMatchesPincode('560001', 'XX')).toBe(false)
  })

  it('allows the neighbours that share a prefix', () => {
    expect(stateMatchesPincode('403001', 'GA')).toBe(true)
    expect(stateMatchesPincode('737101', 'SK')).toBe(true)
    expect(stateMatchesPincode('605001', 'PY')).toBe(true)
    expect(stateMatchesPincode('834001', 'JH')).toBe(true)
    expect(stateMatchesPincode('248001', 'UK')).toBe(true)
    expect(stateMatchesPincode('160017', 'CH')).toBe(true)
    expect(stateMatchesPincode('194101', 'LA')).toBe(true)
    expect(stateMatchesPincode('744101', 'AN')).toBe(true)
    expect(stateMatchesPincode('682555', 'LD')).toBe(true)
    expect(stateMatchesPincode('396210', 'DN')).toBe(true)
  })

  it('refuses nothing it cannot judge (Army Postal Service, unallocated, malformed)', () => {
    expect(stateMatchesPincode('999001', 'DL')).toBe(true)
    expect(stateMatchesPincode('550001', 'DL')).toBe(true)
    expect(stateMatchesPincode('560001x', 'DL')).toBe(true)
  })

  it('lets the India Post directory answer win over the prefix', () => {
    expect(stateMatchesPincode('403001', 'MH', 'GA')).toBe(false)
    expect(stateMatchesPincode('403001', 'GA', 'GA')).toBe(true)
  })

  it('every state and union territory has at least one PIN prefix', () => {
    const covered = new Set<string>()
    for (let p = 11; p <= 89; p++) {
      const pin = `${p}0001`
      const allowed = STATES.filter((s) => stateMatchesPincode(pin, s))
      // An unallocated prefix allows everything; skip it.
      if (allowed.length < STATES.length) for (const s of allowed) covered.add(s)
    }
    expect([...covered].sort()).toEqual([...STATES].sort())
  })
})
