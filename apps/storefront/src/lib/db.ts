import 'server-only'
import { loadEnv } from '@commerce/config'
import { createDb, type Db } from '@commerce/db'

// One pool per process. Next.js re-evaluates modules in dev; the global guards
// against opening a new pool on every hot reload.
const g = globalThis as unknown as { __commerceDb?: Db }

export function db(): Db {
  if (!g.__commerceDb) g.__commerceDb = createDb(loadEnv(process.env).DATABASE_URL)
  return g.__commerceDb
}
