import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as authSchema from './auth-schema'
import * as storeSchema from './schema'

const schema = { ...storeSchema, ...authSchema }

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql }

/**
 * `pooled`: the URL is PgBouncer in transaction mode, where one server connection serves many
 * clients in turn, so a statement prepared by one is not there for the next. Store isolation
 * already fits pooling: `withStore` sets the store per transaction (`set_config(..., true)`).
 * `max`: the pool size (10); a small side connection such as the admin's owner pool sets less.
 * `onStatement`: hears every statement sent (`begin` and `commit` too); tests count a page's
 * statements with it.
 */
export function createDb(
  url: string,
  opts: { pooled?: boolean; max?: number; onStatement?: (query: string) => void } = {},
): Db {
  const onStatement = opts.onStatement
  const sql = postgres(url, {
    max: opts.max ?? 10,
    ...(opts.pooled ? { prepare: false } : {}),
    ...(onStatement ? { debug: (_connection: number, query: string) => onStatement(query) } : {}),
  })
  return drizzle(sql, { schema, casing: 'snake_case' })
}
