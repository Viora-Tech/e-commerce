import type { ShippingProviderFactory } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { definePlugin, loadPlugins, type OrderAction, orderActionsOf } from '../src'

const courier = (id: string): ShippingProviderFactory<Record<string, string>> => ({
  id,
  label: `${id} ship`,
  fields: [],
  validateConfig: (raw) => ({ ok: true, config: (raw ?? {}) as Record<string, string> }),
  create: () => {
    throw new Error('not needed in this test')
  },
})

const queueAction: OrderAction = {
  id: 'add-to-queue',
  label: { en: 'Add to invoice queue', hi: 'इनवॉइस कतार में जोड़ें' },
  targets: ['detail', 'row', 'bulk'],
  handler: { type: 'procedure', procedure: 'gst-invoices/queue-add' },
  requires: ['not-test'],
}

const app = (orderActions: OrderAction[], shipping: string[] = [], id = 'gst-invoices') =>
  definePlugin({
    id,
    name: id,
    version: '1',
    kind: 'builtin',
    access: { resources: [] },
    provides: { shipping: shipping.map(courier) },
    admin: { orderActions },
  })

describe('order actions on the manifest', () => {
  it('accepts a well-formed action and lists it on the summary', () => {
    const loaded = loadPlugins([app([queueAction])])
    expect(loaded.summaries()[0]?.admin.orderActions).toEqual([queueAction])
  })

  it('rejects bad ids, repeats, empty labels and no targets', () => {
    expect(() => app([{ ...queueAction, id: 'Add Queue' }])).toThrow(/lowercase/)
    expect(() => app([queueAction, queueAction])).toThrow(/declared twice/)
    expect(() => app([{ ...queueAction, label: { en: ' ' } }])).toThrow(/English label/)
    expect(() => app([{ ...queueAction, targets: [] }])).toThrow(/at least one target/)
  })

  it('rejects a link outside the admin and an unnamespaced procedure key', () => {
    expect(() =>
      app([{ ...queueAction, handler: { type: 'link', path: 'https://evil.example' } }]),
    ).toThrow(/admin path/)
    expect(() =>
      app([{ ...queueAction, handler: { type: 'link', path: '//evil.example' } }]),
    ).toThrow(/admin path/)
    expect(() =>
      app([{ ...queueAction, handler: { type: 'procedure', procedure: 'orders/delete' } }]),
    ).toThrow(/namespaced "gst-invoices\/<name>"/)
  })

  it('a shipment action must name a courier the plugin provides', () => {
    expect(() =>
      app(
        [{ ...queueAction, id: 'ship', handler: { type: 'shipment', providerId: 'fedex' } }],
        ['delhivery'],
        'delhivery',
      ),
    ).toThrow(/not a courier this plugin provides/)
  })

  it('every courier a plugin provides gets a Create shipment action', () => {
    const delhivery = app([], ['delhivery'], 'delhivery')
    expect(orderActionsOf(delhivery)).toEqual([
      {
        id: 'ship-delhivery',
        label: { en: 'Create shipment', hi: 'शिपमेंट बनाएं' },
        targets: ['detail', 'row', 'bulk'],
        handler: { type: 'shipment', providerId: 'delhivery' },
        permission: 'orders.fulfil',
        requires: ['open', 'unfulfilled', 'paid-or-cod'],
      },
    ])
    const two = app([], ['air', 'surface'], 'multi')
    expect(orderActionsOf(two).map((a) => a.label.en)).toEqual([
      'Create shipment with air ship',
      'Create shipment with surface ship',
    ])
  })

  it("the core plugin's demo courier gets none; the order page has its own", () => {
    const core = app([], ['demo'], 'core')
    expect(orderActionsOf(core)).toEqual([])
  })

  it('a declared id may not take a derived Create shipment id', () => {
    expect(() =>
      app(
        [
          {
            ...queueAction,
            id: 'ship-delhivery',
            handler: { type: 'procedure', procedure: 'delhivery/x' },
          },
        ],
        ['delhivery'],
        'delhivery',
      ),
    ).toThrow(/declared twice/)
  })
})
