import { describe, expect, it } from 'vitest'
import { getRegistries } from './registries'

describe('getRegistries', () => {
  it('loads the core plugin plus commerce.config.ts and memoises', () => {
    const r = getRegistries()
    expect(r.plugins[0]?.id).toBe('core')
    expect(r.payments.ids()).toEqual(expect.arrayContaining(['cod', 'manual', 'razorpay']))
    expect(r.shipping.ids()).toEqual(expect.arrayContaining(['fake', 'delhivery']))
    expect(r.notifications.ids()).toEqual(expect.arrayContaining(['log', 'ses', 'whatsapp']))
    expect(getRegistries()).toBe(r)
  })

  it('a store with nothing installed only sees the built-ins', () => {
    const r = getRegistries().forStore([])
    expect(r.payments.ids()).toEqual(['cod', 'manual'])
    expect(r.shipping.ids()).toEqual(['fake'])
    expect(r.notifications.ids()).toEqual(['log'])
  })
})
