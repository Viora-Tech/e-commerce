import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import DeliveryMethod from './delivery-method'

/* A cart whose products' rules share no courier (owner, 21 Nov 2026): a glass pad that ships
   only by Delhivery and a mouse that ships only by Blue Dart, as two parcels, each with its
   own courier list. */
const card = (routeKey: string, label: string, pricePaise: number) => ({
  routeKey,
  label,
  pricePaise,
  arrives: 'Arrives Wed, 14 Oct',
  logo: null,
  mode: 'surface' as const,
  earliest: '2026-10-14',
})
const rate: CheckoutRate = {
  id: 'std',
  name: 'Delivery',
  pricePaise: 12_900,
  dateRange: 'Wed, 14 Oct',
  codSurchargePaise: null,
  arrives: 'Arrives Wed, 14 Oct',
  fastest: false,
  delivery: {
    codAllowed: true,
    codPricePaise: null,
    codCarrier: null,
    listPricePaise: 12_900,
    optionName: 'Delivery',
    logo: null,
    layout: 'one',
    mode: 'surface',
    choices: [],
    parcels: [
      {
        key: 'loc:open:1',
        choices: [
          card('delhivery:S', 'Delhivery Surface', 0),
          card('delhivery:E', 'Delhivery Express', 4_000),
        ],
        preferred: true,
        fullPrices: false,
        codPricePaise: null,
      },
      {
        key: 'loc:open:2',
        choices: [card('shiprocket:20', 'Blue Dart Air', 12_900)],
        preferred: false,
        fullPrices: false,
        codPricePaise: null,
      },
    ],
  },
}
const parcel = (key: string, title: string) => ({
  key,
  from: 'Gurugram, Haryana',
  items: [{ title, quantity: 1 }],
  dateRange: null,
  onHold: false,
  locationId: 'loc',
  estimate: null,
})
const shipping: CheckoutShipping = {
  delivery: {
    ok: true,
    serviceable: true,
    pincode: '302001',
    codAvailable: true,
    dateRange: 'Wed, 14 Oct',
    earliestDate: '2026-10-14',
    latestDate: '2026-10-14',
    dispatchDate: '2026-10-10',
    dispatchLabel: 'Sat, 10 Oct',
    dispatchesToday: true,
    fallback: false,
    provider: 'delivery-options',
  },
  rates: { kind: 'rates', options: [rate] },
  parcels: [parcel('loc:open:1', 'Glass pad'), parcel('loc:open:2', 'Wireless mouse')],
  arrives: 'Arrives Wed, 14 Oct',
}

describe('DeliveryMethod, a cart split by product rules', () => {
  it('shows each parcel with its products and its own courier list', () => {
    const html = renderToStaticMarkup(
      createElement(DeliveryMethod, {
        shipping,
        rates: [rate],
        selectedId: 'std',
        checking: false,
        unserviceable: false,
        estimate: null,
        onSelect: () => undefined,
        parcelKeys: [null, null],
        onParcelRoute: () => undefined,
      }),
    )
    expect(html).toContain('Ships in 2 parcels')
    expect(html).toContain('Parcel 1')
    expect(html).toContain('Parcel 2')
    expect(html.indexOf('Glass pad')).toBeLessThan(html.indexOf('Delhivery Surface'))
    expect(html.indexOf('Wireless mouse')).toBeGreaterThan(html.indexOf('Delhivery Express'))
    expect(html.indexOf('Blue Dart Air')).toBeGreaterThan(html.indexOf('Wireless mouse'))
    // One radio group per parcel, each with its first courier picked.
    expect(html.match(/name="shipping-rate-1"/g)).toHaveLength(2)
    expect(html.match(/name="shipping-rate-2"/g)).toHaveLength(1)
    expect(html.match(/checked=""/g)).toHaveLength(2)
    // The plain parcel list is not drawn twice.
    expect(html.match(/Ships in 2 parcels/g)).toHaveLength(2)
  })
})
