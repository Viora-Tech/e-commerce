/** SOURCE OF TRUTH: Home's to-do settings in the database — WHAT: load and save which to-do cards a store hides (`store.preferences.homeTodos`, only that key) / WHY: the merchant picks the to-dos Home shows (#1006); writes touch only their key so the Preferences form never loses them */
import { type HomeTodo, parseHomeTodos } from '@commerce/core/home-todos'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'

export async function loadHomeTodos(tx: StoreTx, storeId: string) {
  const [row] = await tx
    .select({ todos: sql<unknown>`${store.preferences} -> 'homeTodos'` })
    .from(store)
    .where(eq(store.id, storeId))
  return parseHomeTodos(row?.todos)
}

export async function saveHomeTodos(tx: StoreTx, storeId: string, hidden: HomeTodo[]) {
  const parsed = parseHomeTodos({ hidden })
  await tx
    .update(store)
    .set({
      preferences: sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{homeTodos}', ${JSON.stringify(parsed)}::jsonb, true)`,
    })
    .where(eq(store.id, storeId))
  return parsed
}
