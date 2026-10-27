/** SOURCE OF TRUTH: markets client tests — WHAT: country list, addresses a market claims, clashes, suggestions / WHY: the dialog and the service refuse the same clashes */
import { describe, expect, it } from 'vitest'
import {
  COUNTRY_CODES,
  currencyForCountry,
  isCountryCode,
  marketPaths,
  pathClash,
  suggestSubfolder,
} from './client'

const gulf = { isPrimary: false, subfolder: 'ae', locale: 'en', locales: ['ar'], name: 'Gulf' }
const india = { isPrimary: true, subfolder: null, locale: 'en', locales: ['hi'], name: 'India' }

describe('markets client', () => {
  it('lists every ISO country once', () => {
    expect(COUNTRY_CODES).toHaveLength(249)
    expect(new Set(COUNTRY_CODES).size).toBe(249)
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true)
    expect(isCountryCode('IN')).toBe(true)
    expect(isCountryCode('XK')).toBe(false)
    expect(isCountryCode('in')).toBe(false)
  })

  it('claims the subfolder and each language form, or the primary market’s languages', () => {
    expect(marketPaths(gulf)).toEqual(['ae', 'en-ae', 'ar-ae'])
    expect(marketPaths(india)).toEqual(['en', 'hi'])
    expect(marketPaths({ ...gulf, subfolder: null })).toEqual([])
    expect(marketPaths({ ...gulf, subfolder: 'en-us' })).toEqual(['en-us'])
  })

  it('finds an address another market already answers on', () => {
    expect(pathClash({ ...gulf, subfolder: 'ar-ae', locales: [] }, [gulf])).toEqual({
      path: 'ar-ae',
      market: gulf,
    })
    const germany = { ...gulf, subfolder: 'de', locales: [], name: 'Germany' }
    expect(pathClash({ ...india, locales: ['hi', 'de'] }, [germany])?.market.name).toBe('Germany')
    expect(pathClash({ ...gulf, subfolder: 'us', locales: [] }, [gulf, india])).toBeNull()
  })

  it('suggests a free subfolder and the country’s currency', () => {
    expect(suggestSubfolder('AE', 'en', [])).toBe('ae')
    expect(suggestSubfolder('AE', 'en', ['ae'])).toBe('en-ae')
    expect(currencyForCountry('AE')).toBe('AED')
    expect(currencyForCountry('DE')).toBe('EUR')
    expect(currencyForCountry('IN')).toBeNull()
  })
})
