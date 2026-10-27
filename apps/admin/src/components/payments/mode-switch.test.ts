import { describe, expect, it } from 'vitest'
import { decideSwitch, keySetStatus } from './mode-switch'

const both = { test: true, live: true }
const testOnly = { test: true, live: false }

describe('decideSwitch', () => {
  it('does nothing when the mode is already in use', () => {
    expect(decideSwitch('test', 'test', both)).toEqual({ kind: 'same' })
  })

  it('blocks going live without live keys', () => {
    expect(decideSwitch('test', 'live', testOnly)).toEqual({ kind: 'blocked', missing: 'live' })
  })

  it('blocks going to test without test keys', () => {
    expect(decideSwitch('live', 'test', { test: false, live: true })).toEqual({
      kind: 'blocked',
      missing: 'test',
    })
  })

  it('asks first when the other keys are saved', () => {
    expect(decideSwitch('test', 'live', both)).toEqual({ kind: 'confirm', to: 'live' })
    expect(decideSwitch('live', 'test', both)).toEqual({ kind: 'confirm', to: 'test' })
  })
})

describe('keySetStatus', () => {
  it('marks the set checkout uses, a waiting set and a missing one', () => {
    expect(keySetStatus('test', 'test', testOnly)).toBe('in-use')
    expect(keySetStatus('live', 'test', both)).toBe('saved')
    expect(keySetStatus('live', 'test', testOnly)).toBe('missing')
  })

  it('never calls a set in use before any keys are saved', () => {
    expect(keySetStatus('live', null, { test: false, live: false })).toBe('missing')
  })
})
