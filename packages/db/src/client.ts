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
 */
export function createDb(url: string, opts: { pooled?: boolean } = {}): Db {
  const sql = postgres(url, { max: 10, ...(opts.pooled ? { prepare: false } : {}) })
  return drizzle(sql, { schema, casing: 'snake_case' })
}
