/** SOURCE OF TRUTH: theme pack tests — WHAT: reading and writing store.apps.settings.core.themePacks / WHY: only opted-in stores get a pack's sections, and the tax switches beside it survive */
import { describe, expect, it } from 'vitest'
import { parseStoreTax, withStoreTax } from '../tax/settings'
import { parseThemePacks } from './theme-packs'

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
