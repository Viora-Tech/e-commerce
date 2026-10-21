/** SOURCE OF TRUTH: theme pack tests — WHAT: reading and writing store.apps.settings.core.themePacks / WHY: only opted-in stores get a pack's sections, and the tax switches beside it survive */
import { describe, expect, it } from 'vitest'
import { parseStoreTax, withStoreTax } from '../tax/settings'
import {
  effectiveThemePacks,
  parseOwnThemePacks,
  parseThemePacks,
  withOwnThemePacks,
} from './theme-packs'

describe('parseThemePacks', () => {
  it('reads no packs from a store that never set any', () => {
    expect(parseThemePacks(null)).toEqual([])
    expect(parseThemePacks({ installed: ['reviews'] })).toEqual([])
    expect(
      parseThemePacks({ installed: [], settings: { core: { themePacks: 'zero-drift' } } }),
    ).toEqual([])
  })

  it('reads the packs a store turned on, dropping unknown ids and repeats', () => {
    const apps = {
      installed: [],
      settings: { core: { themePacks: ['zero-drift', 'nope', 'zero-drift', 3] } },
    }
    expect(parseThemePacks(apps)).toEqual(['zero-drift'])
  })

  it('reads the packs beside the tax switches, as the SQL in the handoff note writes them', () => {
    // The SQL adds `themePacks` into `settings.core`, keeping the tax switches already there.
    const withTax = withStoreTax(
      { installed: ['reviews'] },
      { pricesIncludeGst: false, composition: true },
    )
    const core = withTax.settings?.core as Record<string, unknown>
    const apps = { ...withTax, settings: { core: { ...core, themePacks: ['zero-drift'] } } }
    expect(parseThemePacks(withTax)).toEqual([])
    expect(parseThemePacks(apps)).toEqual(['zero-drift'])
    expect(parseStoreTax(apps)).toEqual({ pricesIncludeGst: false, composition: true })
  })
})

describe('packs per theme', () => {
  it('reads a theme’s own list from its settings, or null when it has none', () => {
    expect(parseOwnThemePacks({ schemes: [] })).toBeNull()
    expect(parseOwnThemePacks(null)).toBeNull()
    expect(parseOwnThemePacks({ themePacks: [] })).toEqual([])
    expect(parseOwnThemePacks({ themePacks: ['zero-drift', 'nope', 'zero-drift'] })).toEqual([
      'zero-drift',
    ])
  })

  it('falls back to the store list only for a theme without its own', () => {
    expect(effectiveThemePacks(null, ['zero-drift'])).toEqual(['zero-drift'])
    expect(effectiveThemePacks([], ['zero-drift'])).toEqual([])
    expect(effectiveThemePacks(['zero-drift'], [])).toEqual(['zero-drift'])
  })

  it('writes the own list beside the settings, and leaves settings alone without one', () => {
    const settings = { preset: 'minimal' }
    expect(withOwnThemePacks(settings, null)).toBe(settings)
    expect(withOwnThemePacks(settings, ['zero-drift', 'zero-drift'])).toEqual({
      preset: 'minimal',
      themePacks: ['zero-drift'],
    })
  })
})
