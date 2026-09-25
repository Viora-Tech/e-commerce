import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { definePlugin, loadPlugins } from '@commerce/plugins'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { corePlugin } from './core-plugin'
import { dispatchAppEvent } from './events'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore(slug: string, installed: string[]) {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, apps: { installed } })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

describe('dispatchAppEvent', () => {
  it("scoped to one pluginId, a throwing hook never runs the other app's hook", async () => {
    const ranA: string[] = []
    const ranB: string[] = []
    const appA = definePlugin({
      id: 'app-a',
      name: 'A',
      version: '0.0.1',
      kind: 'builtin',
      provides: {},
      hooks: {
        'order.paid': async () => {
          ranA.push('ran')
          throw new Error('app A is down')
        },
      },
    })
    const appB = definePlugin({
      id: 'app-b',
      name: 'B',
      version: '0.0.1',
      kind: 'builtin',
      provides: {},
      hooks: {
        'order.paid': async () => {
          ranB.push('ran')
        },
      },
    })
    const plugins = loadPlugins([corePlugin, appA, appB])
    const storeId = await seedStore('events-isolation', ['app-a', 'app-b'])
    const deps = {
      db: app,
      plugins,
      storage: async () => {
        throw new Error('unused')
      },
      settingsSecret: 's',
      storefrontUrl: null,
    }

    // The relay enqueues one job per plugin; each is dispatched independently.
    await expect(
      dispatchAppEvent(deps, {
        storeId,
        event: 'order.paid',
        orderId: 'order-1',
        pluginId: 'app-a',
      }),
    ).rejects.toThrow('app A is down')

    const okResult = await dispatchAppEvent(deps, {
      storeId,
      event: 'order.paid',
      orderId: 'order-1',
      pluginId: 'app-b',
    })

    expect(ranA).toEqual(['ran'])
    expect(ranB).toEqual(['ran'])
    expect(okResult.ran).toEqual(['app-b'])

    // A retry of app A's own job runs only app A's hook again, not app B's.
    await expect(
      dispatchAppEvent(deps, {
        storeId,
        event: 'order.paid',
        orderId: 'order-1',
        pluginId: 'app-a',
      }),
    ).rejects.toThrow('app A is down')
    expect(ranA).toEqual(['ran', 'ran'])
    expect(ranB).toEqual(['ran'])
  })
})
