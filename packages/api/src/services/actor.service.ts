import type { StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'

/** Who is acting in this transaction, for rows that record it by column default (stock history, audit #139). */
export const setActorName = (tx: StoreTx, actor: string) =>
  tx.execute(sql`select set_config('app.actor_name', ${actor}, true)`)
