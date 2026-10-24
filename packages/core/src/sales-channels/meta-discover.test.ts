/** SOURCE OF TRUTH: Meta discovery tests — WHAT: which Graph calls find the business, catalog and WhatsApp account / WHY: a system user token only reaches what was shared with it */
import { describe, expect, test } from 'vitest'
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
  test('a system user token uses its client business and the assets shared with it', async () => {
    // The business's own catalog and WhatsApp lists are left out: Meta refuses them here.
    const { fetchImpl, asked } = fakeGraph({
      '/me': { id: 'su1', client_business_id: 'b1' },
      '/b1': { name: 'Waimers' },
      '/me/assigned_product_catalogs': {
        data: [
          { id: 'c0', name: 'Old catalog' },
          { id: 'c1', name: 'Waimers' },
        ],
      },
      '/me/assigned_whatsapp_business_accounts': { data: [] },
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
    const { fetchImpl } = fakeGraph({
      '/me/businesses': { data: [{ id: 'b2', name: 'Shop' }] },
      '/b2/owned_product_catalogs': { data: [{ id: 'c2', name: 'Shop' }] },
      '/b2/owned_whatsapp_business_accounts': { data: [{ id: 'w2' }] },
      '/me': { id: 'u2' },
    })
    const account = await metaDiscover(fetchImpl, { appId: 'a', appSecret: 's' }, 'tok', 'Shop')
    expect(account.businessId).toBe('b2')
    expect(account.wabaId).toBe('w2')
  })

  test('a system user with no shared catalog is told to share one', async () => {
    const { fetchImpl } = fakeGraph({
      '/me': { id: 'su1', client_business_id: 'b1' },
      '/me/assigned_product_catalogs': { data: [] },
    })
    const app = { appId: 'a', appSecret: 's', loginConfigId: 'cfg' }
    await expect(metaDiscover(fetchImpl, app, 'tok', 'Waimers')).rejects.toThrow(
      'No catalog was shared',
    )
  })

  describe('choosing among shared catalogs (one integration serves every store on the business)', () => {
    const app = { appId: 'a', appSecret: 's', loginConfigId: 'cfg' }
    const shared = (data: { id: string; name: string }[]) =>
      fakeGraph({
        '/me': { id: 'su1', client_business_id: 'b1' },
        '/b1': { name: 'Viora' },
        '/me/assigned_product_catalogs': { data },
        '/me/assigned_whatsapp_business_accounts': { data: [] },
      }).fetchImpl
    const two = [
      { id: 'live', name: 'VIORA INDIA Catalog' },
      { id: 'demo', name: 'Claw Gears (Koomerce)' },
    ]

    test("keeps the store's current catalog on a reconnect", async () => {
      const account = await metaDiscover(shared(two), app, 'tok', 'Waimers (Koomerce)', 'live')
      expect(account.catalogId).toBe('live')
    })

    test('picks the catalog named for this store', async () => {
      const account = await metaDiscover(shared(two), app, 'tok', 'Claw Gears (Koomerce)')
      expect(account.catalogId).toBe('demo')
    })

    test('uses the only shared catalog', async () => {
      const account = await metaDiscover(shared([two[0]!]), app, 'tok', 'New Store (Koomerce)')
      expect(account.catalogId).toBe('live')
    })

    test("refuses to guess between several, so it never syncs into another store's catalog", async () => {
      await expect(metaDiscover(shared(two), app, 'tok', 'New Store (Koomerce)')).rejects.toThrow(
        `Name this store's catalog "New Store (Koomerce)"`,
      )
    })
  })

  test('a refused step names itself in the error', async () => {
    const { fetchImpl } = fakeGraph({ '/me': { id: 'su1', client_business_id: 'b1' } })
    const app = { appId: 'a', appSecret: 's', loginConfigId: 'cfg' }
    await expect(metaDiscover(fetchImpl, app, 'tok', 'Waimers')).rejects.toThrow(
      'catalogs: (#100) Missing Permission',
    )
  })
})
