import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  defaultGlobeSettings,
  loadGlobeSettings,
  saveGlobeSettings,
  saveLastZoom,
} from './globe-settings'

/** A minimal in-memory `localStorage`, since these tests run in Node (no jsdom `window`). */
class FakeStorage {
  private store = new Map<string, string>()
  throwOnSet = false
  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new Error('quota exceeded')
    this.store.set(key, value)
  }
}

let storage: FakeStorage

beforeEach(() => {
  storage = new FakeStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: storage }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('defaultGlobeSettings', () => {
  it('turns auto-rotate off by default for reduced-motion, on otherwise', () => {
    expect(defaultGlobeSettings(true).motion.autoRotate).toBe(false)
    expect(defaultGlobeSettings(false).motion.autoRotate).toBe(true)
  })

  it('defaults to the store accent theme, solid land, 24h, India', () => {
    const d = defaultGlobeSettings(false)
    expect(d.look.theme).toBe('accent')
    expect(d.look.style).toBe('solid')
    expect(d.look.borderStyle).toBe('solid')
    expect(d.data.timeRange).toBe('24h')
    expect(d.motion.startView).toBe('india')
    expect(d.layers).toEqual({
      borders: true,
      coastlines: true,
      grid: true,
      arcs: true,
      glow: true,
    })
  })
})

describe('loadGlobeSettings / saveGlobeSettings', () => {
  it('falls back to defaults when nothing is saved', () => {
    expect(loadGlobeSettings(false)).toEqual(defaultGlobeSettings(false))
  })

  it('round-trips a saved change', () => {
    const next = defaultGlobeSettings(false)
    next.look.style = 'dotted'
    next.layers.grid = false
    saveGlobeSettings(next)
    expect(loadGlobeSettings(false)).toEqual(next)
  })

  it('never throws when storage is unavailable, and falls back to defaults', () => {
    storage.throwOnSet = true
    expect(() => saveGlobeSettings(defaultGlobeSettings(false))).not.toThrow()

    ;(globalThis as { window?: unknown }).window = undefined
    expect(loadGlobeSettings(false)).toEqual(defaultGlobeSettings(false))
  })

  it('ignores corrupt storage and falls back to defaults', () => {
    storage.setItem('wc-live-globe-settings-v1', '{not json')
    expect(loadGlobeSettings(false)).toEqual(defaultGlobeSettings(false))
  })

  it('sanitises an invalid enum back to its default rather than rejecting the whole save', () => {
    storage.setItem(
      'wc-live-globe-settings-v1',
      JSON.stringify({ look: { theme: 'not-a-real-theme' }, motion: { speed: 'ludicrous' } }),
    )
    const loaded = loadGlobeSettings(false)
    expect(loaded.look.theme).toBe('accent')
    expect(loaded.motion.speed).toBe('normal')
  })

  it('only accepts a well-formed hex colour for a custom override', () => {
    storage.setItem(
      'wc-live-globe-settings-v1',
      JSON.stringify({ look: { customLand: 'javascript:alert(1)', customOcean: '#1a2b3c' } }),
    )
    const loaded = loadGlobeSettings(false)
    expect(loaded.look.customLand).toBeNull()
    expect(loaded.look.customOcean).toBe('#1a2b3c')
  })
})

describe('saveLastZoom', () => {
  it('persists the zoom without disturbing the rest of a saved settings object', () => {
    const settings = defaultGlobeSettings(false)
    settings.look.style = 'dotted'
    saveGlobeSettings(settings)

    saveLastZoom(2.5)

    const loaded = loadGlobeSettings(false)
    expect(loaded.lastZoom).toBe(2.5)
    expect(loaded.look.style).toBe('dotted')
  })

  it('creates a settings entry when nothing has been saved yet', () => {
    saveLastZoom(1.8)
    expect(loadGlobeSettings(false).lastZoom).toBe(1.8)
  })

  it('never throws when storage is unavailable', () => {
    storage.throwOnSet = true
    expect(() => saveLastZoom(1.2)).not.toThrow()
  })
})
