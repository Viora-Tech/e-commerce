import type { NotificationChannelFactory } from '@commerce/notifications'
import type { PaymentProviderFactory } from '@commerce/payments'
import type { ShippingProviderFactory } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { definePlugin, loadPlugins } from '../src'

const payment = (id: string): PaymentProviderFactory<Record<string, string>> => ({
  id,
  label: `${id} pay`,
  fields: [],
  validateConfig: (raw) => ({ ok: true, config: (raw ?? {}) as Record<string, string> }),
  create: () => {
    throw new Error('not needed in this test')
  },
})
const courier = (id: string): ShippingProviderFactory<Record<string, string>> => ({
  id,
  label: `${id} ship`,
  fields: [],
  validateConfig: (raw) => ({ ok: true, config: (raw ?? {}) as Record<string, string> }),
  create: () => {
    throw new Error('not needed in this test')
  },
})
const channel = (id: string): NotificationChannelFactory<Record<string, string>> => ({
  id,
  label: `${id} notify`,
  fields: [],
  validateConfig: (raw) => ({ ok: true, config: (raw ?? {}) as Record<string, string> }),
  create: () => {
    throw new Error('not needed in this test')
  },
})

const core = definePlugin({
  id: 'core',
  name: 'Core',
  version: '1.0.0',
  provides: {
    payments: [payment('cod')],
    shipping: [courier('demo')],
    notifications: [channel('log')],
  },
})
const razorpay = definePlugin({
  id: 'razorpay',
  name: 'Razorpay',
  version: '1.2.0',
  description: 'Cards, UPI, netbanking',
  provides: { payments: [payment('razorpay')] },
})
const fedex = definePlugin({
  id: 'fedex',
  name: 'FedEx',
  version: '0.1.0',
  provides: { shipping: [courier('fedex')] },
})

describe('definePlugin', () => {
  it('rejects ids that are not lowercase slugs', () => {
    expect(() => definePlugin({ id: 'Razor Pay', name: 'x', version: '1', provides: {} })).toThrow(
      /lowercase/,
    )
  })

  it('fills missing kinds with empty arrays', () => {
    expect(fedex.provides.payments).toEqual([])
    expect(fedex.provides.notifications).toEqual([])
  })
})

describe('loadPlugins', () => {
  it('registers every provider from every plugin', () => {
    const loaded = loadPlugins([core, razorpay, fedex])
    expect(loaded.payments.ids()).toEqual(['cod', 'razorpay'])
    expect(loaded.shipping.ids()).toEqual(['demo', 'fedex'])
    expect(loaded.notifications.ids()).toEqual(['log'])
    expect(loaded.owners.payments.razorpay).toBe('razorpay')
    expect(loaded.owners.shipping.fedex).toBe('fedex')
  })

  it('names both plugins when two claim the same id', () => {
    const again = definePlugin({
      id: 'razorpay',
      name: 'Razorpay fork',
      version: '2',
      provides: {},
    })
    expect(() => loadPlugins([core, razorpay, again])).toThrow(
      'duplicate plugin id "razorpay": "Razorpay" v1.2.0 and "Razorpay fork" v2',
    )
  })

  it('names both plugins when two provide the same provider id', () => {
    const clash = definePlugin({
      id: 'other-fedex',
      name: 'Other',
      version: '1',
      provides: { shipping: [courier('fedex')] },
    })
    expect(() => loadPlugins([core, fedex, clash])).toThrow(
      'shipping provider "fedex" is provided by both plugin "fedex" and plugin "other-fedex"',
    )
  })

  it('forStore keeps core and only the installed plugins', () => {
    const loaded = loadPlugins([core, razorpay, fedex])
    const r = loaded.forStore(['fedex'])
    expect(r.payments.ids()).toEqual(['cod'])
    expect(r.shipping.ids()).toEqual(['demo', 'fedex'])
    expect(loaded.forStore([]).shipping.ids()).toEqual(['demo'])
  })

  it('summaries are serialisable and mark core as built in', () => {
    const [c, r] = loadPlugins([core, razorpay]).summaries()
    expect(c).toMatchObject({ id: 'core', builtIn: true })
    expect(r).toMatchObject({
      id: 'razorpay',
      builtIn: false,
      description: 'Cards, UPI, netbanking',
      provides: { payments: [{ id: 'razorpay', label: 'razorpay pay' }], shipping: [] },
    })
    expect(JSON.parse(JSON.stringify(r))).toEqual(r)
  })

  it('providerIds lists what a plugin contributes, for uninstall clean-up', () => {
    const loaded = loadPlugins([core, razorpay, fedex])
    expect(loaded.providerIds('fedex')).toEqual({
      payments: [],
      shipping: ['fedex'],
      notifications: [],
      storage: [],
    })
    expect(loaded.providerIds('nope')).toEqual({
      payments: [],
      shipping: [],
      notifications: [],
      storage: [],
    })
  })
})
