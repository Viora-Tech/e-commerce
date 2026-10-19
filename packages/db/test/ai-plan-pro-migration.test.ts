import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { aiSettings } from '../src/ai-schema'
import { createDb } from '../src/client'
import { store } from '../src/schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0136 renames the Pro plan's AI tier from 'unlimited' to 'pro'. The fixture is a row as the
 * old check allowed it, put back by dropping the new check; the migration then moves it to
 * 'pro' and the check refuses the old name.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0136_ai_plan_pro.sql'),
  'utf8',
)

async function runMigration() {
  for (const statement of MIGRATION.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
})

describe('0136 ai plan pro', () => {
  it("moves 'unlimited' rows to 'pro' and refuses the old name after", async () => {
    const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
    const storeId = s?.id as string
    await retryOnDeadlock(() =>
      owner.execute(sql`alter table "ai_settings" drop constraint "ai_settings_plan_check"`),
    )
    await owner.execute(
      sql`alter table "ai_settings" add constraint "ai_settings_plan_check" check ("plan" in ('free', 'starter', 'growth', 'unlimited'))`,
    )
    await owner.execute(
      sql`insert into "ai_settings" ("id", "store_id", "plan") values (gen_random_uuid(), ${storeId}, 'unlimited')`,
    )
    await runMigration()
    const [row] = await owner.select().from(aiSettings).where(eq(aiSettings.storeId, storeId))
    expect(row?.plan).toBe('pro')
    await expect(
      owner.execute(
        sql`update "ai_settings" set "plan" = 'unlimited' where "store_id" = ${storeId}`,
      ),
    ).rejects.toThrow()
  })
})
