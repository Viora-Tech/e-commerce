import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as authSchema from './auth-schema'
import * as storeSchema from './schema'

const schema = { ...storeSchema, ...authSchema }

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql }

export function createDb(url: string): Db {
  const sql = postgres(url, { max: 10 })
  return drizzle(sql, { schema, casing: 'snake_case' })
}
