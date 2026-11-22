import type { StoreTx } from '@commerce/db'
import { ShippingRegistry, type ShippingProviderFactory } from '@commerce/shipping'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const connected = vi.hoisted(() => ({ ids: new Set<string>() }))

vi.mock('../src/services/shipping.service', () => ({ loadShippingSettings: async () => ({}) }))
vi.mock('@commerce/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@commerce/core')>()),
  shippingProviderById: (_r: unknown, _s: unknown, _k: string, id: string) =>
    connected.ids.has(id) ? { id } : null,
}))

const { connectedCourierApp } = await import('../src/services/order-fulfil.service')

const app = (id: string, label: string) =>
  ({ id, label, fields: [], capabilities: [], create: () => ({}) }) as unknown as ShippingProviderFactory<unknown>

const registry = new ShippingRegistry().register(app('delhivery', 'Delhivery'))
const tx = {} as StoreTx
const find = (courier: string | undefined) =>
  connectedCourierApp(tx, 'store-1', registry, 'secret', courier)

describe('connectedCourierApp (#2462: a hand-typed Delhivery AWB was never tracked)', () => {
  beforeEach(() => {
    connected.ids = new Set(['delhivery'])
  })

  it('maps the courier name from the pack form to the connected app', async () => {
    expect(await find('Delhivery')).toBe('delhivery')
    expect(await find(' delhivery ')).toBe('delhivery')
  })

  it('keeps the bare name when the app is not connected', async () => {
    connected.ids = new Set()
    expect(await find('Delhivery')).toBeUndefined()
  })

  it('leaves couriers without an app, and no courier, alone', async () => {
    expect(await find('India Post')).toBeUndefined()
    expect(await find(undefined)).toBeUndefined()
    expect(await find('')).toBeUndefined()
  })
})
