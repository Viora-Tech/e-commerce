#!/usr/bin/env bun
/**
 * Puts one of Koomerce's own stores on the unlimited plan (or takes it off). There is no
 * platform admin UI, and a merchant can never set this.
 *
 *   bun run platform:unlimited waimers
 *   bun run platform:unlimited waimers --off
 *
 * On: Scale's features with no limits on orders, staff or storage, no per-order fee, no bills
 * or renewals, no fair-use notices, and AI capped at 50,000 credits a month as a safety net.
 * See core `billing/unlimited.ts`.
 */
import { loadEnv } from '@commerce/config'
import { setStoreUnlimited } from '@commerce/core'
import { createDb } from '@commerce/db'

async function main() {
  const slug = process.argv[2]?.trim().toLowerCase()
  const on = !process.argv.includes('--off')
  if (!slug || slug.startsWith('-')) {
    console.error('Usage: bun run platform:unlimited <store slug> [--off]')
    process.exitCode = 1
    return
  }

  const env = loadEnv(process.env)
  const db = createDb(env.DATABASE_URL_OWNER)
  try {
    const done = await setStoreUnlimited(db, slug, on)
    if (!done) {
      console.error(`No store with the address ${slug}`)
      process.exitCode = 1
      return
    }
    console.log(`${done.name} (${slug}) is ${on ? 'now unlimited' : 'no longer unlimited'}`)
  } finally {
    await db.$client.end()
  }
}

if (import.meta.main) {
  await main()
}
