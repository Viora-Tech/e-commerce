import { createHash } from 'node:crypto'
import { normaliseCustomerFacts } from '@commerce/core/pixels'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hashShopperFacts,
  listenForShopperFacts,
  loadServerMatch,
  mergeMatch,
  reportShopperFacts,
  resetShopperFacts,
} from './match'

const h = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')

beforeEach(() => resetShopperFacts())
afterEach(() => vi.unstubAllGlobals())

describe('browser advanced matching', () => {
  it('normalises like the server and hashes every value with SHA-256', async () => {
    const facts = {
      email: '  Asha.Rao@Example.COM ',
      phone: '+91 98765-43210',
      name: 'Asha K. Rao',
      city: 'Navi Mumbai',
      state: 'MH',
      pincode: '400 703',
      country: 'IN',
    }
    const out = await hashShopperFacts(facts)
    expect(out).toEqual({
      em: h('asha.rao@example.com'),
      ph: h('919876543210'),
      fn: h('asha'),
      ln: h('rao'),
      ct: h('navimumbai'),
      st: h('mh'),
      zp: h('400703'),
      country: h('in'),
    })
    // The same normalised values the server Conversions API hashes.
    const server = normaliseCustomerFacts(facts)
    for (const [k, v] of Object.entries(server)) expect(out?.[k as keyof typeof out]).toBe(h(v))
    expect(JSON.stringify(out)).not.toMatch(/asha|example|98765/i)
  })

  it('gives nothing when only the default country is known', async () => {
    expect(await hashShopperFacts({ email: 'nope', phone: '123' })).toBeNull()
  })

  it('checkout facts reach no pixel until the marketing listener is listening', () => {
    const apply = vi.fn()
    reportShopperFacts({ email: 'a@b.in' })
    // No yes to marketing: nobody is listening, nothing is applied.
    expect(apply).not.toHaveBeenCalled()
    const stop = listenForShopperFacts(apply)
    expect(apply).toHaveBeenCalledWith({ email: 'a@b.in' })
    reportShopperFacts({ email: 'c@d.in' })
    expect(apply).toHaveBeenLastCalledWith({ email: 'c@d.in' })
    stop()
    reportShopperFacts({ email: 'e@f.in' })
    expect(apply).toHaveBeenCalledTimes(2)
  })

  it('typed values win key by key over the server ones', () => {
    expect(mergeMatch({ em: 'a', external_id: 'x' }, { em: 'b', ph: 'c' })).toEqual({
      em: 'b',
      ph: 'c',
      external_id: 'x',
    })
    expect(mergeMatch(null, null)).toBeNull()
  })

  it('takes only hashed values from /api/px/me, and nothing on 204 or failure', async () => {
    const em = h('a@b.in')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ match: { em, ph: '919876543210' } })),
    )
    expect(await loadServerMatch()).toEqual({ em })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )
    expect(await loadServerMatch()).toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await loadServerMatch()).toBeNull()
  })
})
