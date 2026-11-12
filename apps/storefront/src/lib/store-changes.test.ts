import { describe, expect, it, vi } from 'vitest'
import { createStoreChangeHub, dropOnStoreChange } from './store-changes'

describe('createStoreChangeHub', () => {
  it('fans a change out to every listener', () => {
    const hub = createStoreChangeHub()
    const a = vi.fn()
    const b = vi.fn()
    hub.subscribe({ onChange: a })
    const stop = hub.subscribe({ onChange: b })
    hub.change('s1', false)
    expect(a).toHaveBeenCalledWith('s1', false)
    expect(b).toHaveBeenCalledWith('s1', false)
    stop()
    hub.change('s2', true)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('tells a late listener the hub is already live', () => {
    const hub = createStoreChangeHub()
    hub.live()
    const onLive = vi.fn()
    hub.subscribe({ onLive })
    expect(onLive).toHaveBeenCalledTimes(1)
    hub.lost()
    expect(hub.isLive).toBe(false)
    const later = vi.fn()
    hub.subscribe({ onLive: later })
    expect(later).not.toHaveBeenCalled()
  })

  it('keeps going when one listener throws', () => {
    const hub = createStoreChangeHub()
    const after = vi.fn()
    hub.subscribe({
      onChange: () => {
        throw new Error('boom')
      },
    })
    hub.subscribe({ onChange: after })
    hub.change('s1', false)
    expect(after).toHaveBeenCalledTimes(1)
  })
})

describe('dropOnStoreChange', () => {
  it('drops a store on a hard change, ignores soft ones, clears all on reconnect', () => {
    const hub = createStoreChangeHub()
    const cache = new Map([
      ['s1', 1],
      ['s2', 2],
    ])
    hub.subscribe(dropOnStoreChange({ store: (id) => cache.delete(id), all: () => cache.clear() }))
    hub.change('s1', true)
    expect([...cache.keys()]).toEqual(['s1', 's2'])
    hub.change('s1', false)
    expect([...cache.keys()]).toEqual(['s2'])
    hub.live()
    expect(cache.size).toBe(0)
  })
})
