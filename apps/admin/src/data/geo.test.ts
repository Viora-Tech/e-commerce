import { describe, expect, it } from 'vitest'
import {
  CITY_COORDS,
  normaliseCityName,
  resolveDispatchLocation,
  resolveOrderLocation,
  resolveStateCode,
  STATE_CENTROIDS,
} from './geo'
import { INDIAN_STATES } from './india'

/** A few UT codes addresses can carry that predate `INDIAN_STATES` (see `data/india-map.ts`'s
 * removal notes): no separate legislature, so they were left out of that shipping-address list,
 * but the globe still needs a point for them. */
const EXTRA_UT_CODES = ['AN', 'DN', 'LD']

describe('geo', () => {
  it('gives every shipping-address state a centroid inside a plausible India bounding box', () => {
    for (const { code } of INDIAN_STATES) {
      const c = STATE_CENTROIDS[code]
      expect(c, `${code} has no centroid`).toBeDefined()
      expect(c?.lat).toBeGreaterThan(6)
      expect(c?.lat).toBeLessThan(36)
      expect(c?.lng).toBeGreaterThan(68)
      expect(c?.lng).toBeLessThan(98)
    }
  })

  it('also covers the UTs without a legislature (Andaman & Nicobar, Dadra & Nagar Haveli and Daman & Diu, Lakshadweep)', () => {
    for (const code of EXTRA_UT_CODES) {
      expect(STATE_CENTROIDS[code], code).toBeDefined()
    }
  })

  it('every city belongs to a real state code and sits inside the same bounding box', () => {
    for (const [name, city] of Object.entries(CITY_COORDS)) {
      expect(
        STATE_CENTROIDS[city.stateCode],
        `${name} -> unknown state ${city.stateCode}`,
      ).toBeDefined()
      expect(city.lat, name).toBeGreaterThan(6)
      expect(city.lat, name).toBeLessThan(36)
      expect(city.lng, name).toBeGreaterThan(68)
      expect(city.lng, name).toBeLessThan(98)
    }
  })

  describe('normaliseCityName', () => {
    it('lowercases, trims and collapses whitespace', () => {
      expect(normaliseCityName('  Bengaluru  ')).toBe('bengaluru')
      expect(normaliseCityName('New   Delhi')).toBe('new delhi')
    })

    it('drops a trailing city/district suffix', () => {
      expect(normaliseCityName('Bengaluru City')).toBe('bengaluru')
      expect(normaliseCityName('Pune District')).toBe('pune')
    })
  })

  describe('resolveStateCode', () => {
    it('accepts a code as-is', () => {
      expect(resolveStateCode('KA')).toBe('KA')
      expect(resolveStateCode('ka')).toBe('KA')
    })

    it('matches a full state name, case-insensitively', () => {
      expect(resolveStateCode('Karnataka')).toBe('KA')
      expect(resolveStateCode('tamil nadu')).toBe('TN')
    })

    it('returns null for empty or unrecognised input', () => {
      expect(resolveStateCode('')).toBeNull()
      expect(resolveStateCode(undefined)).toBeNull()
      expect(resolveStateCode('Narnia')).toBeNull()
    })
  })

  describe('resolveOrderLocation', () => {
    it('resolves a known city that matches its state code', () => {
      const loc = resolveOrderLocation('Bengaluru', 'KA')
      expect(loc).toEqual({ lat: 12.97, lng: 77.59, source: 'city' })
    })

    it('is case- and whitespace-insensitive on the city name', () => {
      expect(resolveOrderLocation('  MUMBAI ', 'MH')?.source).toBe('city')
    })

    it('falls back to the state centroid when the city is unknown', () => {
      const loc = resolveOrderLocation('Some Small Town', 'KA')
      expect(loc).toEqual({
        lat: STATE_CENTROIDS.KA?.lat,
        lng: STATE_CENTROIDS.KA?.lng,
        source: 'state',
      })
    })

    it('falls back to the state centroid when the city belongs to a different state', () => {
      // Bengaluru is a Karnataka city; asking for it under Tamil Nadu should not
      // silently place the marker in the wrong state.
      const loc = resolveOrderLocation('Bengaluru', 'TN')
      expect(loc?.source).toBe('state')
      expect(loc).toMatchObject({ lat: STATE_CENTROIDS.TN?.lat, lng: STATE_CENTROIDS.TN?.lng })
    })

    it('returns null for an unknown state code', () => {
      expect(resolveOrderLocation('Nowhere', 'ZZ')).toBeNull()
    })
  })

  describe('resolveDispatchLocation', () => {
    it('resolves a known city regardless of the state text', () => {
      const loc = resolveDispatchLocation('Bengaluru', 'Karnataka')
      expect(loc).toEqual({ lat: 12.97, lng: 77.59, source: 'city' })
    })

    it('falls back to the state centroid from a free-text state name', () => {
      const loc = resolveDispatchLocation('Some Small Town', 'Karnataka')
      expect(loc?.source).toBe('state')
      expect(loc).toMatchObject({ lat: STATE_CENTROIDS.KA?.lat, lng: STATE_CENTROIDS.KA?.lng })
    })

    it('returns null when neither the city nor the state resolves', () => {
      expect(resolveDispatchLocation('', '')).toBeNull()
    })
  })
})
