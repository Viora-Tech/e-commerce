import { describe, expect, it } from 'vitest'
import { courierRows, routeRows } from './courier-rows'
import type { CatalogueRoute } from './format'

const route = (over: Partial<CatalogueRoute>): CatalogueRoute => ({
  key: 'delhivery:S',
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  channel: 'direct',
  carrierKey: 'delhivery',
  carrier: 'Delhivery',
  showCarrier: true,
  serviceId: 'S',
  serviceLabel: 'Surface',
  speed: 'standard',
  costPaise: 6000,
  codCostPaise: null,
  costFromCard: false,
  quotedInsurancePaise: null,
  minTransitDays: 4,
  maxTransitDays: 5,
  codAvailable: true,
  serviceable: true,
  insures: true,
  insurancePercent: null,
  insuranceMinPaise: null,
  enabled: true,
  source: 'live',
  ms: 300,
  ...over,
})

const ROUTES = [
  route({}),
  route({ key: 'delhivery:E', serviceId: 'E', serviceLabel: 'Express', speed: 'express' }),
  route({
    key: 'shiprocket:7',
    providerId: 'shiprocket',
    providerLabel: 'Shiprocket',
    channel: 'aggregator',
    carrierKey: 'ekart',
    carrier: 'Ekart',
    codAvailable: false,
  }),
  route({
    key: 'rapidshyp:EK',
    providerId: 'rapidshyp',
    providerLabel: 'RapidShyp',
    channel: 'aggregator',
    carrierKey: 'ekart',
    carrier: 'Ekart',
  }),
  route({
    key: 'bluedart:',
    providerId: 'bluedart',
    providerLabel: 'Blue Dart',
    carrierKey: 'bluedart',
    carrier: 'Blue Dart',
    speed: 'express',
    costPaise: null,
    enabled: false,
  }),
]

describe('route rows (Routes, one per courier and app)', () => {
  it('joins a direct courier’s speeds into one row saved under its own key', () => {
    const rows = routeRows(ROUTES)
    expect(rows.map((r) => r.id)).toEqual([
      'delhivery|delhivery',
      'shiprocket|ekart',
      'rapidshyp|ekart',
      'bluedart|bluedart',
    ])
    expect(rows[0]).toMatchObject({
      speeds: ['standard', 'express'],
      price: 'live',
      settingKey: 'carrier:delhivery|channel:delhivery',
    })
    expect(rows[1]?.cod).toBe(false)
    expect(rows[3]).toMatchObject({ price: 'none', enabled: false })
  })
})

describe('courier rows (the courier list, one per courier and speed)', () => {
  it('merges apps offering the same courier and leaves out routes turned off', () => {
    const rows = courierRows(ROUTES)
    expect(rows.map((r) => r.id)).toEqual([
      'delhivery:standard',
      'delhivery:express',
      'ekart:standard',
    ])
    expect(rows[2]).toMatchObject({ direct: false, via: ['Shiprocket', 'RapidShyp'] })
  })
})
