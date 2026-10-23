import { createDb, media, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { listMedia } from './service'
import { mediaUsage } from './usage'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('media with no stored type', () => {
  it('sorts by the extension of the key, else the URL without its query', async () => {
    const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
    if (!s) throw new Error('seed')
    const storeId = s.id
    const row = (url: string, key: string | null, size: number) => ({
      storeId,
      url,
      key,
      contentType: null,
      size,
      status: 'ready' as const,
    })
    await owner
      .insert(media)
      .values([
        row('https://cdn.shopify.com/s/files/a.JPG?v=17', null, 100),
        row('https://cdn.shopify.com/s/files/b.webp?v=18', null, 200),
        row('https://media.test/stores/x/c', 'stores/x/c.mp4', 1000),
        row('https://cdn.shopify.com/s/files/d.pdf?v=1', null, 10),
        row('https://cdn.shopify.com/s/files/e?name=e.png', null, 1),
      ])

    const usage = await withStore(app, storeId, (tx) => mediaUsage(tx))
    expect(usage).toMatchObject({
      image: { files: 2, bytes: 300 },
      video: { files: 1, bytes: 1000 },
      document: { files: 2, bytes: 11 },
    })

    const keysOf = async (fileType: 'image' | 'video' | 'document') => {
      const page = await withStore(app, storeId, (tx) =>
        listMedia(tx, { page: 1, perPage: 10, fileType }),
      )
      return page.items.map((f) => f.url.split('/').pop()).sort()
    }
    expect(await keysOf('image')).toEqual(['a.JPG?v=17', 'b.webp?v=18'])
    expect(await keysOf('video')).toEqual(['c'])
    expect(await keysOf('document')).toEqual(['d.pdf?v=1', 'e?name=e.png'])
  })
})
