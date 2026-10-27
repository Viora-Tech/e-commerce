import { describe, expect, it } from 'vitest'
import { initialKeySetMode, keySetValues, withEditedKeySet } from './connect-key-sets'

const empty = { clientId: '', mode: 'test' }
const testSet = { clientId: 'test-client', mode: 'test' }
const liveSet = { clientId: 'live-client', mode: 'live' }

describe('initialKeySetMode', () => {
  it('follows ?keys=, else the set in use, else test', () => {
    expect(initialKeySetMode({ decentro: testSet }, 'decentro', '?keys=live')).toBe('live')
    expect(initialKeySetMode({ decentro: liveSet }, 'decentro', '')).toBe('live')
    expect(initialKeySetMode({}, 'decentro', '')).toBe('test')
  })
})

describe('keySetValues', () => {
  it('reads the waiting set for the other mode, not the set in use', () => {
    const providers = { decentro: testSet, 'decentro~live': liveSet }
    expect(keySetValues(providers, 'decentro', 'live', empty).clientId).toBe('live-client')
    expect(keySetValues(providers, 'decentro', 'test', empty).clientId).toBe('test-client')
  })

  it('starts a missing set empty, tagged with its mode', () => {
    expect(keySetValues({ decentro: testSet }, 'decentro', 'live', empty)).toEqual({
      clientId: '',
      mode: 'live',
    })
  })
})

describe('withEditedKeySet', () => {
  it('parks live keys saved while checkout runs on test, without switching', () => {
    const blob = { enabled: ['decentro'], providers: { decentro: testSet } }
    const next = withEditedKeySet(blob, 'decentro', 'live', { clientId: 'new-live' })
    expect(next.providers.decentro).toEqual(testSet)
    expect(next.providers['decentro~live']).toEqual({ clientId: 'new-live', mode: 'live' })
  })

  it('saves the set in use in place and turns the app on', () => {
    const blob = { enabled: [], providers: {} }
    const next = withEditedKeySet(blob, 'decentro', 'test', { clientId: 'first' })
    expect(next.providers.decentro).toEqual({ clientId: 'first', mode: 'test' })
    expect(next.enabled).toEqual(['decentro'])
  })

  it('does not turn the app on when only a waiting set is saved', () => {
    const blob = { enabled: [], providers: { decentro: testSet } }
    expect(withEditedKeySet(blob, 'decentro', 'live', liveSet).enabled).toEqual([])
  })
})
