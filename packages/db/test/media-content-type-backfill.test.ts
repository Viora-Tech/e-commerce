import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { asc, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { media, store } from '../src/schema'
import { resetDb } from './reset'

/* 0148 gives media stored without a type the one its key, else URL, extension implies. */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0148_media_content_type_backfill.sql'),
  'utf8',
)

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0148 media content type backfill', () => {
  it('fills a missing type from the key or URL extension and leaves the rest alone', async () => {
    const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
    if (!s) throw new Error('seed')
    const row = (n: number, url: string, key: string | null, contentType: string | null) => ({
      storeId: s.id,
      url,
      key,
      contentType,
      alt: String(n),
    })
    await owner
      .insert(media)
      .values([
        row(1, 'https://cdn.shopify.com/s/files/a.JPG?v=1', null, null),
        row(2, 'https://cdn.shopify.com/s/files/b.webp?v=2', null, null),
        row(3, 'https://cdn.shopify.com/s/files/c.avif', null, null),
        row(4, 'https://media.test/x', 'stores/x/clip.mov', null),
        row(5, 'https://cdn.shopify.com/s/files/d.pdf?v=3', null, null),
        row(6, 'https://cdn.shopify.com/s/files/e?name=e.png', null, null),
        row(7, 'https://cdn.shopify.com/s/files/f.txt', null, null),
        row(8, 'https://cdn.shopify.com/s/files/g.png', null, 'image/webp'),
      ])

    await owner.execute(sql.raw(MIGRATION))
    // Running it again changes nothing.
    await owner.execute(sql.raw(MIGRATION))

    const rows = await owner
      .select({ alt: media.alt, contentType: media.contentType })
      .from(media)
      .orderBy(asc(media.alt))
    expect(rows.map((r) => r.contentType)).toEqual([
      'image/jpeg',
      'image/webp',
      'image/avif',
      'video/quicktime',
      'application/pdf',
      null,
      null,
      'image/webp',
    ])
  })
})
