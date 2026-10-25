import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { store } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * The Pixels storefront migration bumps every store's cookie banner version (the marketing line
 * now names advertising partners such as Meta), keeping a store's own message.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const DIR = join(import.meta.dirname, '..', 'drizzle')
const FILE = readdirSync(DIR).find((f) => f.endsWith('_pixels_storefront.sql')) as string
const MIGRATION = readFileSync(join(DIR, FILE), 'utf8')
const BUMP = MIGRATION.slice(MIGRATION.indexOf('-- BUMP'))

async function runBump() {
  for (const statement of BUMP.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
})

describe('pixels storefront migration', () => {
  it("bumps every store's banner version and keeps its message", async () => {
    await owner.insert(store).values([
      {
        slug: 'a',
        name: 'A',
        preferences: { customerPrivacy: { bannerMessage: 'Hi', bannerVersion: 4 } },
      },
      { slug: 'b', name: 'B', preferences: { privacy: { message: 'Old text' } } },
      { slug: 'c', name: 'C' },
    ])
    await runBump()
    const rows = await owner
      .select({ slug: store.slug, preferences: store.preferences })
      .from(store)
    const privacy = (slug: string) =>
      (rows.find((r) => r.slug === slug)?.preferences as { customerPrivacy?: unknown } | null)
        ?.customerPrivacy
    expect(privacy('a')).toEqual({ bannerMessage: 'Hi', bannerVersion: 5 })
    expect(privacy('b')).toEqual({ bannerMessage: 'Old text', bannerVersion: 2 })
    expect(privacy('c')).toEqual({ bannerMessage: '', bannerVersion: 2 })
  })
})
