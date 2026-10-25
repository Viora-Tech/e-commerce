import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { metafieldDefinition, role, rolePermission, store } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0108 lets extra fields live on variants, customers, orders, pages, articles and the shop, and
 * hands the new `content.manage_types` permission to every role that could manage content types
 * (content.write) or extra fields (settings.manage) before, plus the system Administrator.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0108_metafield_owners.sql'),
  'utf8',
)
const BACKFILL = MIGRATION.slice(MIGRATION.indexOf('-- BACKFILL'))

async function runBackfill() {
  for (const statement of BACKFILL.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
})

async function seedRoles() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const storeId = s?.id as string
  const make = async (slug: string, isSystem: boolean, perms: string[]) => {
    const [r] = await owner.insert(role).values({ storeId, name: slug, slug, isSystem }).returning()
    const roleId = r?.id as string
    if (perms.length) {
      await owner
        .insert(rolePermission)
        .values(perms.map((permission) => ({ storeId, roleId, permission })))
    }
    return roleId
  }
  return {
    storeId,
    admin: await make('admin', true, []),
    staff: await make('staff', true, ['orders.read', 'products.read']),
    writer: await make('writer', false, ['content.read', 'content.write']),
    settings: await make('settings', false, ['settings.read', 'settings.manage']),
    reader: await make('reader', false, ['content.read', 'settings.read']),
    already: await make('already', false, ['content.write', 'content.manage_types']),
  }
}

const holds = async (roleId: string) =>
  (
    await owner
      .select()
      .from(rolePermission)
      .where(
        and(
          eq(rolePermission.roleId, roleId),
          eq(rolePermission.permission, 'content.manage_types'),
        ),
      )
  ).length

describe('0108 metafield owners', () => {
  it('gives content.manage_types to the roles that could manage types or extra fields', async () => {
    const r = await seedRoles()
    await runBackfill()
    expect(await holds(r.admin)).toBe(1)
    expect(await holds(r.writer)).toBe(1)
    expect(await holds(r.settings)).toBe(1)
    expect(await holds(r.staff)).toBe(0)
    expect(await holds(r.reader)).toBe(0)
    expect(await holds(r.already)).toBe(1)
    // Running it again changes nothing.
    await runBackfill()
    expect(await holds(r.writer)).toBe(1)
  })

  it('accepts every new owner type and still refuses unknown ones', async () => {
    const { storeId } = await seedRoles()
    for (const ownerType of [
      'product',
      'variant',
      'collection',
      'customer',
      'order',
      'page',
      'article',
      'shop',
    ] as const) {
      await owner
        .insert(metafieldDefinition)
        .values({ storeId, ownerType, key: 'note', name: 'Note', type: 'single_line_text' })
    }
    await expect(
      owner.execute(
        sql`insert into metafield_definition (id, store_id, owner_type, key, name, type) values (gen_random_uuid(), ${storeId}, 'location', 'note', 'Note', 'single_line_text')`,
      ),
    ).rejects.toThrow()
  })
})
