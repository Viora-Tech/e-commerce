/**
 * Shopify store credit → the customer's store credit balance here (issue #1227). Store credit
 * is a balance with a ledger, never a gift card, so each Shopify account in INR becomes ledger
 * lines on its customer: kind `adjustment`, reason "Imported from Shopify (store credit)" plus
 * the Shopify account number. Those lines are the record of what came from Shopify, so a re-run
 * sums them and adds only the difference (nothing when Shopify's balance is unchanged). A balance
 * that went down in Shopify is taken back, unless the customer already spent it here.
 * Skipped, with a note in the report: other currencies, customers not here, and the whole step
 * when the app lacks `read_store_credit_accounts`.
 */
import { changeStoreCredit } from '@commerce/core'
import { customer, type StoreTx, storeCreditAccount, storeCreditEntry } from '@commerce/db'
import { CURRENCIES, type Currency, formatMoney } from '@commerce/money'
import { and, eq, sql } from 'drizzle-orm'
import { fetchStoreCredit } from './api-store-credit'
import { REQUIRED_SCOPES } from './client'
import { errorMessage, findMapping, type ImportContext, saveMapping } from './runtime'
import { type ShopifyClient, ShopifyError } from './shopify-client'
import type { NStoreCreditAccount } from './types'

const R = 'store_credit'
/** The only currency store credit is held in here. */
const CURRENCY = 'INR'
const STORE_CREDIT_IMPORT_REASON = 'Imported from Shopify (store credit)'

const amount = (minor: number, currency: string) =>
  formatMoney(minor, currency in CURRENCIES ? (currency as Currency) : CURRENCY)

/** The ledger reason, naming the Shopify account so its lines can be found again. */
function importReason(sourceId: string): string {
  const number = sourceId.split('/').pop() ?? sourceId
  return `${STORE_CREDIT_IMPORT_REASON} · Shopify account ${number}`
}

async function customerFor(tx: StoreTx, a: NStoreCreditAccount): Promise<string | null> {
  const mapped = await findMapping(tx, 'customers', a.customer.sourceId)
  if (mapped) {
    const [row] = await tx.select({ id: customer.id }).from(customer).where(eq(customer.id, mapped))
    if (row) return row.id
  }
  if (!a.customer.email) return null
  const [row] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.email, a.customer.email))
  return row?.id ?? null
}

/** What earlier imports of this Shopify account put on the customer's balance, in paise. */
async function importedSoFar(tx: StoreTx, customerId: string, reason: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string | null>`sum(${storeCreditEntry.amountPaise})` })
    .from(storeCreditEntry)
    .where(
      and(
        eq(storeCreditEntry.customerId, customerId),
        eq(storeCreditEntry.kind, 'adjustment'),
        eq(storeCreditEntry.reason, reason),
      ),
    )
  return Number(row?.total ?? 0)
}

async function balanceOf(tx: StoreTx, customerId: string): Promise<number> {
  const [row] = await tx
    .select({ balance: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  return row?.balance ?? 0
}

type Tally = { customers: Set<string>; amountPaise: number }

function tallied(ctx: ImportContext, tally: Tally, key: string, paise: number) {
  if (paise <= 0) return
  tally.customers.add(key)
  tally.amountPaise += paise
  ctx.report.of(R).credit = { customers: tally.customers.size, amountPaise: tally.amountPaise }
}

async function writeAccount(
  ctx: ImportContext,
  a: NStoreCreditAccount,
  tally: Tally,
): Promise<void> {
  const ref = a.customer.email ?? a.customer.name ?? a.customer.sourceId
  try {
    if (a.currency !== CURRENCY) {
      ctx.report.count(R, 'skipped')
      ctx.report.leave(R, 'store_credit_currency', 1, a.currency)
      ctx.report.issue({
        resource: R,
        ref,
        message: `${amount(a.balancePaise, a.currency)} store credit is in ${a.currency}; store credit here is in ${CURRENCY}, so it stays in Shopify`,
      })
      return
    }
    const reason = importReason(a.sourceId)
    const customerId = await ctx.inStore((tx) => customerFor(tx, a))
    // A preview runs before customers are imported; the Shopify customer will be there by then.
    if (!customerId && !ctx.dryRun) {
      ctx.report.count(R, 'skipped')
      ctx.report.leave(R, 'store_credit_no_customer')
      ctx.report.issue({
        resource: R,
        ref,
        message: `${amount(a.balancePaise, a.currency)} store credit, but this customer is not here. Import customers, then run the import again`,
      })
      return
    }
    const { before, known } = await ctx.inStore(async (tx) => ({
      before: customerId ? await importedSoFar(tx, customerId, reason) : 0,
      known: Boolean(await findMapping(tx, R, a.sourceId)),
    }))
    if (ctx.dryRun) {
      ctx.report.count(R, known ? 'updated' : 'created')
      ctx.report.sample({
        resource: R,
        key: a.sourceId,
        title: ref,
        action: known ? 'update' : 'create',
        detail: amount(a.balancePaise, a.currency),
      })
      tallied(ctx, tally, a.customer.sourceId, a.balancePaise)
      return
    }
    const id = customerId as string
    const after = await ctx.inStore(async (tx) => {
      const scope = { tx, storeId: ctx.storeId }
      const delta = a.balancePaise - before
      if (delta < 0 && (await balanceOf(tx, id)) < -delta) {
        ctx.report.leave(R, 'store_credit_used_here')
        ctx.report.issue({
          resource: R,
          ref,
          message: `Shopify's balance went down to ${amount(a.balancePaise, a.currency)}, but the credit was already spent here, so the balance here was kept`,
        })
        return before
      }
      if (delta !== 0) {
        await changeStoreCredit(scope, {
          customerId: id,
          amountPaise: delta,
          kind: 'adjustment',
          reason,
        })
      }
      await saveMapping(tx, ctx.storeId, R, a.sourceId, id)
      return a.balancePaise
    })
    ctx.report.count(R, known ? 'updated' : 'created')
    tallied(ctx, tally, id, after)
  } catch (err) {
    ctx.report.count(R, 'failed')
    ctx.report.issue({ resource: R, ref, sourceId: a.sourceId, message: errorMessage(err) })
  }
}

/**
 * The store credit step, after customers. Accounts with nothing on them that were never
 * imported are not counted; one imported before and emptied in Shopify is taken back to zero.
 */
export async function importStoreCredit(
  ctx: ImportContext,
  client: ShopifyClient,
  /** On a retry or "Import remaining", only the accounts this says yes to. */
  only: ((sourceId: string) => boolean) | null = null,
  onBulkFallback?: (reason: unknown) => void,
): Promise<void> {
  ctx.report.begin(R)
  const tally: Tally = { customers: new Set(), amountPaise: 0 }
  try {
    for await (const page of fetchStoreCredit(client, onBulkFallback)) {
      const wanted = only ? page.filter((a) => only(a.sourceId)) : page
      const batch: NStoreCreditAccount[] = []
      for (const a of wanted) {
        if (a.balancePaise > 0 || (await ctx.inStore((tx) => findMapping(tx, R, a.sourceId)))) {
          batch.push(a)
        }
      }
      ctx.report.addTotal(R, batch.length)
      for (const a of batch) {
        await writeAccount(ctx, a, tally)
        await ctx.report.flush()
      }
    }
  } catch (err) {
    if (!(err instanceof ShopifyError) || err.kind !== 'scope') throw err
    // An app or token without the scope: skip store credit, import everything else.
    ctx.report.leave(R, 'store_credit_scope')
    ctx.report.issue({
      resource: R,
      message: `Store credit was skipped: your Shopify app cannot read store credit (${REQUIRED_SCOPES[R]}). Add that scope in Shopify, test the connection, then import Store credit again.`,
    })
  }
}
