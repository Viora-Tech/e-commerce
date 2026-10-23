#!/usr/bin/env bun
import { loadEnv } from '@commerce/config'
/**
 * Moves stores' Growth marketing automations onto the Automations engine (design
 * docs/superpowers/specs/2026-10-23-automations-app-design.md §10). Per store, in one
 * transaction: every `marketing_automation` becomes an `automation_workflow` with the same id,
 * every run an `automation_run` with the same id (open runs wait on the step they would run
 * next), messages get their engine run and node, and `store.preferences.automationsEngine`
 * flips to `engine`, after which the old marketing tick leaves the store alone. Then it compares
 * run counts, open runs, conversions and the next due time per automation, old vs new.
 *
 * Dry run by default: the cutover runs and is checked inside a transaction that is rolled back.
 * Idempotent: a store already on the engine is reported and skipped. Only run `--apply` where
 * the engine's worker (trigger sweeps and the step tick) is deployed, or open runs will wait.
 *
 *   bun scripts/migrate-marketing-automations.ts --store <id|slug>          # dry run, one store
 *   bun scripts/migrate-marketing-automations.ts --all                      # dry run, every store
 *   bun scripts/migrate-marketing-automations.ts --store <id|slug> --apply  # cut over
 */
import {
  type CutoverCheck,
  type CutoverReport,
  cutoverStoreToEngine,
  verifyCutover,
} from '@commerce/core'
import { createDb, marketingAutomation, store, withStore } from '@commerce/db'
import { eq, inArray, or } from 'drizzle-orm'

class DryRun extends Error {
  constructor(
    readonly report: CutoverReport,
    readonly checks: CutoverCheck[],
  ) {
    super('dry run')
  }
}

function argValues(flag: string): string[] {
  const out: string[] = []
  process.argv.forEach((a, i) => {
    if (a === flag && process.argv[i + 1]) out.push(process.argv[i + 1] as string)
  })
  return out
}

const UUID = /^[0-9a-f-]{36}$/i

async function main() {
  const env = loadEnv(process.env)
  const apply = process.argv.includes('--apply')
  const all = process.argv.includes('--all')
  const wanted = argValues('--store')
  if (!all && wanted.length === 0) {
    console.error('migrate-marketing-automations: pass --store <id|slug> (repeatable) or --all')
    process.exit(2)
  }
  if (apply && all) {
    console.error('migrate-marketing-automations: --apply takes explicit --store values, not --all')
    process.exit(2)
  }
  // The owner connection finds stores across tenants; each cutover runs store-scoped (RLS).
  const owner = createDb(env.DATABASE_URL_OWNER)
  const app = createDb(env.DATABASE_URL)

  const stores = all
    ? await owner
        .selectDistinct({ id: store.id, slug: store.slug })
        .from(store)
        .innerJoin(marketingAutomation, eq(marketingAutomation.storeId, store.id))
    : await owner
        .select({ id: store.id, slug: store.slug })
        .from(store)
        .where(
          or(
            inArray(store.slug, wanted),
            inArray(
              store.id,
              wanted.filter((w) => UUID.test(w)),
            ),
          ),
        )
  console.log(
    `migrate-marketing-automations: ${apply ? 'APPLY' : 'dry run'} — ${stores.length} store(s)`,
  )

  let failed = 0
  for (const s of stores) {
    let report: CutoverReport
    let checks: CutoverCheck[]
    try {
      if (apply) {
        ;({ report, checks } = await withStore(app, s.id, async (tx) => {
          const r = await cutoverStoreToEngine(tx, s.id)
          const c = await verifyCutover(tx, s.id)
          // A mismatch rolls the store back to legacy.
          if (!r.alreadyEngine && c.some((x) => !x.ok)) throw new DryRun(r, c)
          return { report: r, checks: c }
        }))
      } else {
        try {
          await withStore(app, s.id, async (tx) => {
            throw new DryRun(await cutoverStoreToEngine(tx, s.id), await verifyCutover(tx, s.id))
          })
          throw new Error('unreachable')
        } catch (err) {
          if (!(err instanceof DryRun)) throw err
          ;({ report, checks } = err)
        }
      }
    } catch (err) {
      failed += 1
      if (err instanceof DryRun) {
        console.error(`  ${s.slug}: checks failed, rolled back`)
        for (const c of err.checks.filter((x) => !x.ok)) console.error(`    ${JSON.stringify(c)}`)
      } else {
        console.error(`  ${s.slug}: ${err instanceof Error ? err.message : String(err)}`)
      }
      continue
    }
    if (report.alreadyEngine) {
      console.log(`  ${s.slug}: already on the engine`)
      continue
    }
    const bad = checks.filter((c) => !c.ok)
    console.log(
      `  ${s.slug}: ${report.workflows} automation(s), ${report.runs} run(s) (${report.openRuns} open), ` +
        `${report.messagesLinked} message(s) linked` +
        (report.skippedAutomations.length
          ? `, skipped unknown triggers: ${report.skippedAutomations.join(', ')}`
          : '') +
        (bad.length ? `, ${bad.length} check(s) FAILED` : ', checks ok') +
        (apply ? '' : ' (rolled back)'),
    )
    for (const c of bad) console.log(`    ${JSON.stringify(c)}`)
    if (bad.length) failed += 1
  }

  await owner.$client.end()
  await app.$client.end()
  if (!apply) console.log('migrate-marketing-automations: dry run only — pass --apply to cut over.')
  if (failed > 0) process.exit(1)
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
