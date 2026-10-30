import { describe, expect, it } from 'vitest'
import {
  isLocalRateId,
  LocalDeliverySchema,
  type LocalOptionLocation,
  localOptions,
  rateRowId,
  withLocalOptions,
} from './local-options'
import { primaryRateId } from './profiles'
import type { ShippingRateOption } from './rates'

const shop = (over: Partial<LocalOptionLocation> = {}): LocalOptionLocation => ({
  id: 'loc-1',
  name: 'Indiranagar',
  active: true,
  localDelivery: {
    enabled: true,
    pincodes: ['560038', '5601*'],
    pricePaise: 4000,
    minOrderPaise: 50_000,
    freeAbovePaise: 150_000,
    instructions: 'Between 4 and 8 pm',
  },
  storePickup: { enabled: true, readyIn: 'Ready in 2 hours', instructions: 'Ask at the desk' },
  ...over,
})

const blr = { stateCode: 'KA', pincode: '560038' }

const zoneRate: ShippingRateOption = {
  rateId: 'rate-1',
  name: 'Standard',
  zoneId: 'z1',
  zoneName: 'All India',
  listPricePaise: 4900,
  pricePaise: 4900,
  codSurchargePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
}

describe('local delivery and pickup in store (audit #163)', () => {
  it('offers local delivery to its PIN codes and pickup to every Indian address', () => {
    const options = localOptions([shop()], blr, 60_000)
    expect(options.map((o) => o.rateId)).toEqual(['local:loc-1', 'pickup:loc-1'])
    expect(options[0]).toMatchObject({ pricePaise: 4000, name: 'Local delivery from Indiranagar' })
    expect(options[1]).toMatchObject({
      pricePaise: 0,
      local: { kind: 'pickup', instructions: 'Ready in 2 hours. Ask at the desk' },
    })
    // A prefix with a spaced PIN code still matches.
    expect(localOptions([shop()], { stateCode: 'KA', pincode: '560 102' }, 60_000)).toHaveLength(2)
    // Outside its PIN codes only pickup is left.
    expect(localOptions([shop()], { stateCode: 'MH', pincode: '400001' }, 60_000)).toHaveLength(1)
  })

  it('needs the minimum order, and turns free from the free-above value', () => {
    expect(localOptions([shop()], blr, 49_999).map((o) => o.rateId)).toEqual(['pickup:loc-1'])
    expect(localOptions([shop()], blr, 150_000)[0]).toMatchObject({
      listPricePaise: 4000,
      pricePaise: 0,
    })
  })

  it('skips switched-off options, inactive locations and addresses abroad', () => {
    const off = shop({ storePickup: { enabled: false, readyIn: '', instructions: '' } })
    expect(localOptions([off], { stateCode: 'MH', pincode: '400001' }, 60_000)).toEqual([])
    expect(localOptions([shop({ active: false })], blr, 60_000)).toEqual([])
    expect(localOptions([shop()], { ...blr, countryCode: 'AE' }, 60_000)).toEqual([])
  })

  it('comes after the zone rates, alone when no zone covers the address, never for free stores', () => {
    const local = localOptions([shop()], blr, 60_000)
    const rates = withLocalOptions({ kind: 'rates', options: [zoneRate] }, local)
    expect(rates.kind === 'rates' ? rates.options.map((o) => o.rateId) : []).toEqual([
      'rate-1',
      'local:loc-1',
      'pickup:loc-1',
    ])
    expect(withLocalOptions({ kind: 'no_rates' }, local).kind).toBe('rates')
    expect(withLocalOptions({ kind: 'not_configured' }, local)).toEqual({ kind: 'not_configured' })
    expect(withLocalOptions({ kind: 'no_rates' }, [])).toEqual({ kind: 'no_rates' })
  })

  it('keeps no rate row id for a local option', () => {
    expect(isLocalRateId('pickup:loc-1')).toBe(true)
    expect(rateRowId('local:loc-1', primaryRateId)).toBeNull()
    expect(rateRowId('a+b', primaryRateId)).toBe('a')
  })

  it('needs PIN codes when local delivery is on', () => {
    const base = { enabled: true, pricePaise: 0 }
    expect(LocalDeliverySchema.safeParse({ ...base, pincodes: [] }).success).toBe(false)
    expect(LocalDeliverySchema.safeParse({ ...base, pincodes: ['56'] }).success).toBe(false)
    expect(LocalDeliverySchema.safeParse({ ...base, pincodes: ['56*'] }).success).toBe(true)
    expect(LocalDeliverySchema.safeParse({ enabled: false }).success).toBe(true)
  })
})
