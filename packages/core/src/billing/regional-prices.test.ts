/** SOURCE OF TRUTH: regional price tests — WHAT: tier per country and price per currency / WHY: the stored table must match the 2026-10-28 decision */
import { describe, expect, it } from 'vitest'
import {
  OWN_IT_PRICES,
  REGIONAL_PRICING_LIVE,
  regionalPrice,
  regionForCountry,
} from './regional-prices'

describe('regional prices', () => {
  it('maps countries to tiers', () => {
    for (const c of ['US', 'GB', 'DE', 'FR', 'JP', 'AU', 'CA', 'SG', 'AE'])
      expect(regionForCountry(c)).toBe('tier1')
    expect(regionForCountry('IN')).toBe('india')
    expect(regionForCountry('ID')).toBe('tier2')
    expect(regionForCountry('BR')).toBe('tier2')
    expect(regionForCountry(null)).toBe('india')
  })

  it('prices each plan per region and currency', () => {
    expect(regionalPrice('starter', 'tier1', 'USD', 'month')).toBe(1900)
    expect(regionalPrice('scale', 'tier2', 'USD', 'month')).toBe(19900)
    expect(regionalPrice('growth', 'tier1', 'GBP', 'month')).toBe(3900)
    expect(regionalPrice('pro', 'tier1', 'EUR', 'month')).toBe(11900)
    expect(regionalPrice('scale', 'tier1', 'JPY', 'month')).toBe(52_000)
    expect(regionalPrice('pro', 'tier1', 'USD', 'year')).toBe(129_000)
    expect(regionalPrice('growth', 'india', 'INR', 'month')).toBe(1_99_900)
    expect(regionalPrice('starter', 'tier2', 'GBP', 'month')).toBeNull()
    expect(REGIONAL_PRICING_LIVE).toBe(false)
  })

  it('prices Own it per region', () => {
    expect(OWN_IT_PRICES.india).toEqual({
      licence: 49_99_900,
      carePerMonth: 3_00_000,
      currency: 'INR',
    })
    expect(OWN_IT_PRICES.tier1).toEqual({ licence: 1_99_900, carePerMonth: 9_900, currency: 'USD' })
    expect(OWN_IT_PRICES.tier2).toEqual({ licence: 1_29_900, carePerMonth: 6_900, currency: 'USD' })
  })
})
