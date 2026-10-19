import 'server-only'
import { loadEnv } from '@commerce/config'
import { createDb, type Db } from '@commerce/db'

const g = globalThis as unknown as { __commerceDb?: Db }

export function db(): Db {
  if (!g.__commerceDb) {
    const env = loadEnv(process.env)
    g.__commerceDb = createDb(env.DATABASE_URL, { pooled: env.DATABASE_POOLED })
  }
  return g.__commerceDb
}
