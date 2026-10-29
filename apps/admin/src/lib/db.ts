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

const owner = globalThis as unknown as { __commerceOwnerDb?: Db }

/**
 * The OWNER connection, for the platform console (`platform.*`) only: it sees every store.
 * A small pool of its own; every console query on it runs read-only (`platformRead`). Never
 * hand it to store procedures, the bearer-token API or MCP.
 */
export function ownerDb(): Db {
  if (!owner.__commerceOwnerDb) {
    const env = loadEnv(process.env)
    owner.__commerceOwnerDb = createDb(env.DATABASE_URL_OWNER, { max: 2 })
  }
  return owner.__commerceOwnerDb
}
