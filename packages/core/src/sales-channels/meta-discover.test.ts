import { describe, expect, test } from 'bun:test'
import { metaDiscover } from './providers'

/** A fake Graph: answers by path, records every path asked for. */
function fakeGraph(routes: Record<string, unknown>) {
  const asked: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(String(input))
    const path = url.pathname.replace(/^\/v[\d.]+/, '')
    asked.push(`${url.searchParams.has('name') ? 'POST ' : ''}${path}`)
    const body = routes[path]
    if (body === undefined)
      return new Response(JSON.stringify({ error: { message: '(#100) Missing Permission' } }), {
        status: 400,
      })
    return new Response(JSON.stringify(body))
  }) as typeof fetch
  return { fetchImpl, asked }
}

describe('metaDiscover', () => {
  test('a system user token finds its business through debug_token, not /me/businesses', async () => {
    const { fetchImpl, asked } = fakeGraph({
      '/debug_token': {
        data: { granular_scopes: [{ scope: 'business_management', target_ids: ['b1'] }] },
      },
      '/b1': { id: 'b1', name: 'Waimers' },
      '/b1/owned_product_catalogs': { data: [{ id: 'c1', name: 'Waimers' }] },
      '/b1/owned_whatsapp_business_accounts': { data: [] },
      '/me': { id: 'su1' },
    })
    const app = { appId: 'a', appSecret: 's', loginConfigId: 'cfg' }
    const account = await metaDiscover(fetchImpl, app, 'tok', 'Waimers')
    expect(account).toEqual({
      businessId: 'b1',
      businessName: 'Waimers',
      catalogId: 'c1',
      wabaId: null,
      userId: 'su1',
    })
    expect(asked).not.toContain('/me/businesses')
  })

  test('a user token (no login configuration) lists its businesses', async () => {
    const { fetchImpl, asked } = fakeGraph({
      '/me/businesses': { data: [{ id: 'b2', name: 'Shop' }] },
      '/b2/owned_product_catalogs': { data: [{ id: 'c2', name: 'Shop' }] },
      '/b2/owned_whatsapp_business_accounts': { data: [{ id: 'w2' }] },
      '/me': { id: 'u2' },
    })
    const account = await metaDiscover(fetchImpl, { appId: 'a', appSecret: 's' }, 'tok', 'Shop')
    expect(account.businessId).toBe('b2')
    expect(account.wabaId).toBe('w2')
    expect(asked).not.toContain('/debug_token')
  })
})
