import 'server-only'
import { loadEnv } from '@commerce/config'
import { createDb, type Db } from '@commerce/db'

const g = globalThis as unknown as { __commerceDb?: Db }

export function db(): Db {
  if (!g.__commerceDb) g.__commerceDb = createDb(loadEnv(process.env).DATABASE_URL)
  return g.__commerceDb
}
