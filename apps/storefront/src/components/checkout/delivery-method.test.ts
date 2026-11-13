import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import DeliveryMethod from './delivery-method'

const delivery = {
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
  provider: 'delhivery',
} as const
const standard: CheckoutRate = {
  id: 'std',
  name: 'Standard delivery',
  pricePaise: 0,
  dateRange: 'Wed, 14 Oct',
  codSurchargePaise: null,
  arrives: 'Arrives Wed, 14 Oct',
  fastest: false,
}
const express: CheckoutRate = {
  id: 'exp',
  name: 'Express delivery',
  pricePaise: 14_900,
  dateRange: 'Sun, 11 Oct',
  codSurchargePaise: null,
  arrives: 'Arrives tomorrow, Sun, 11 Oct',
  fastest: true,
}
const shipping = (rates: CheckoutShipping['rates']): CheckoutShipping => ({
  delivery,
  rates,
  parcels: [],
  arrives: 'Arrives Wed, 14 Oct',
})

const render = (props: Partial<Parameters<typeof DeliveryMethod>[0]>) =>
  renderToStaticMarkup(
    createElement(DeliveryMethod, {
      shipping: shipping({ kind: 'rates', options: [standard, express] }),
      rates: [standard, express],
      selectedId: 'std',
      checking: false,
      unserviceable: false,
      estimate: null,
      onSelect: () => undefined,
      ...props,
    }),
  )

describe('DeliveryMethod', () => {
  it('shows each option with its arrival date and price, the fastest marked', () => {
    const html = render({})
    expect(html).toContain('Arrives Wed, 14 Oct')
    expect(html).toContain('Arrives tomorrow, Sun, 11 Oct')
    expect(html).toContain('₹149')
    expect(html).toContain('Free')
    expect(html.match(/Fastest/g)).toHaveLength(1)
    expect(html.indexOf('Fastest')).toBeGreaterThan(html.indexOf('Express delivery'))
    expect(html.match(/type="radio"/g)).toHaveLength(2)
    expect(html).toMatch(/value="std"[^>]*checked|checked[^>]*value="std"/)
  })

  it('shows free shipping as one card with its arrival', () => {
    const html = render({ shipping: shipping({ kind: 'free' }), rates: [] })
    expect(html).toContain('Free delivery')
    expect(html).toContain('Arrives Wed, 14 Oct')
  })

  it('says why it cannot deliver, and waits while the courier answers', () => {
    expect(render({ unserviceable: true, estimate: 'We cannot deliver to 744101 yet.' })).toContain(
      'role="alert"',
    )
    expect(render({ checking: true })).toContain('Checking delivery')
  })

  describe('the courier list (Figma 942:513)', () => {
    afterEach(() => {
      vi.useRealTimers()
    })
    const choice = (
      routeKey: string,
      label: string,
      pricePaise: number,
      mode: 'air' | 'express' | 'surface',
      earliest: string,
    ) => ({
      routeKey,
      label,
      pricePaise,
      arrives: `Arrives ${earliest}`,
      logo: null,
      mode,
      earliest,
    })
    const list: CheckoutRate = {
      ...standard,
      name: 'Standard',
      delivery: {
        codAllowed: true,
        codPricePaise: null,
        codCarrier: null,
        listPricePaise: 0,
        optionName: 'Standard',
        logo: null,
        layout: 'list',
        mode: 'surface',
        choices: [
          choice('d:S', 'Delhivery', 0, 'surface', '2026-10-18'),
          choice('d:E', 'Delhivery', 5_900, 'express', '2026-10-17'),
          choice('b:A', 'Blue Dart', 9_900, 'air', '2026-10-16'),
        ],
      },
    }

    it('gives each courier card its mode and payment facts, and counts down on the first to arrive', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-15T08:00:00.000Z'))
      const html = render({
        shipping: {
          ...shipping({ kind: 'rates', options: [list] }),
          dispatchCutoffAt: '2026-10-15T10:14:00.000Z',
        },
        rates: [list],
        codOffered: true,
      })
      expect(html).toContain('Surface · cash on delivery available')
      expect(html).toContain('Express · cash on delivery available')
      expect(html).toContain('By air · order in the next 2 h 14 min · cash on delivery available')
      expect(html.match(/order in the next/g)).toHaveLength(1)
    })

    it('says nothing of the countdown without a cut-off, and a prepaid option says pay online', () => {
      const prepaid: CheckoutRate = {
        ...list,
        delivery: {
          ...(list.delivery as NonNullable<CheckoutRate['delivery']>),
          codAllowed: false,
        },
      }
      const html = render({ rates: [prepaid], codOffered: true })
      expect(html).not.toContain('order in the next')
      expect(html).toContain('By air · pay online for this option')
    })
  })
})
