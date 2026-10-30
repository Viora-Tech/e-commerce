import {
  cart,
  customer,
  type MarketingAutomationStatus,
  marketingAutomation,
  marketingAutomationRun,
  marketingMessage,
  order,
  type StoreTx,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, asc, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { z } from 'zod'
import { recoveryUrl } from '../cart/abandoned'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { insertOutboxEvent } from '../outbox/write'
import { hasMarketingConsent } from '../privacy/client'
import { normalisePhone } from './audience'
import { legacyOwnsStore } from './automation-cutover'
import {
  AutomationSettingsSchema,
  type AutomationStep,
  AutomationStepsSchema,
  type AutomationTrigger,
  automationTemplate,
  conditionHolds,
  isTransactionalStep,
  parseAutomationSettings,
  parseAutomationSteps,
  STOPS_ON_ORDER,
} from './automation-steps'
import { applyMergeTags, type EmailCartLine, type MergeValues } from './email'
import { markEngineConversions } from './growth-engine'
import { issuePersonalCode } from './personal-code'
import { RECIPIENT_MISMATCH, recipientIsCustomers } from './recipient'
import {
  firstName,
  type MarketingDeps,
  marketingChannels,
  sendMarketingEmail,
  sendMarketingWhatsapp,
  storeSender,
} from './send'

export type AutomationRow = typeof marketingAutomation.$inferSelect
type RunRow = typeof marketingAutomationRun.$inferSelect

/** A run started more than this long ago no longer gets credit for an order. */
export const CONVERSION_WINDOW_DAYS = 14
/** Baskets older than this are not chased, however the settings read. */
const ABANDONED_LOOKBACK_DAYS = 7
const RUNS_PER_TICK = 50
const DAY_MS = 86_400_000

export const AutomationInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  steps: AutomationStepsSchema,
  settings: AutomationSettingsSchema,
})
export type AutomationInput = z.infer<typeof AutomationInputSchema>

// ---------------------------------------------------------------------------
// CRUD

export async function createAutomationFromTemplate(
  tx: StoreTx,
  storeId: string,
  templateId: string,
): Promise<AutomationRow | null> {
  const t = automationTemplate(templateId)
  if (!t) return null
  const [row] = await tx
    .insert(marketingAutomation)
    .values({
      storeId,
      template: t.id,
      trigger: t.trigger,
      name: t.name,
      status: 'paused',
      steps: t.steps,
      settings: t.settings,
    })
    .returning()
  return row ?? null
}

export async function getAutomation(tx: StoreTx, id: string): Promise<AutomationRow | null> {
  const [row] = await tx.select().from(marketingAutomation).where(eq(marketingAutomation.id, id))
  return row ?? null
}

export async function updateAutomation(tx: StoreTx, id: string, input: AutomationInput) {
  const [row] = await tx
    .update(marketingAutomation)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(marketingAutomation.id, id))
    .returning()
  return row ?? null
}

/** Pausing holds every run where it is; resuming picks up at the next tick. */
export async function setAutomationStatus(
  tx: StoreTx,
  id: string,
  status: MarketingAutomationStatus,
) {
  const [row] = await tx
    .update(marketingAutomation)
    .set({ status, updatedAt: new Date() })
    .where(eq(marketingAutomation.id, id))
    .returning()
  return row ?? null
}

export async function deleteAutomation(tx: StoreTx, id: string) {
  await tx.delete(marketingAutomation).where(eq(marketingAutomation.id, id))
}

export type AutomationStats = {
  runs: number
  active: number
  converted: number
  sent: number
  opened: number
  clicked: number
  orders: number
  revenuePaise: number
}

const EMPTY: AutomationStats = {
  runs: 0,
  active: 0,
  converted: 0,
  sent: 0,
  opened: 0,
  clicked: 0,
  orders: 0,
  revenuePaise: 0,
}

/**
 * Runs, messages and the orders that ended a run (the shopper converted
 * while in the sequence), per automation.
 */
export async function automationStats(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, AutomationStats>> {
  const out = new Map<string, AutomationStats>(ids.map((id) => [id, { ...EMPTY }]))
  if (ids.length === 0) return out
  const runs = await tx
    .select({
      id: marketingAutomationRun.automationId,
      runs: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'active')::int`,
      converted: sql<number>`count(*) filter (where ${marketingAutomationRun.status} = 'converted')::int`,
      revenue: sql<number>`coalesce(sum(o.total_paise) filter (where ${marketingAutomationRun.status} = 'converted' and not o.is_test), 0)::int`,
    })
    .from(marketingAutomationRun)
    .leftJoin(sql`"order" o`, sql`o.id = ${marketingAutomationRun.convertedOrderId}`)
    .where(inArray(marketingAutomationRun.automationId, ids))
    .groupBy(marketingAutomationRun.automationId)
  const messages = await tx
    .select({
      id: marketingMessage.automationId,
      sent: sql<number>`count(*) filter (where ${marketingMessage.status} = 'sent')::int`,
      opened: sql<number>`count(${marketingMessage.openedAt})::int`,
      clicked: sql<number>`count(${marketingMessage.clickedAt})::int`,
    })
    .from(marketingMessage)
    .where(inArray(marketingMessage.automationId, ids))
    .groupBy(marketingMessage.automationId)
  for (const r of runs) {
    const s = out.get(r.id)
    if (s)
      Object.assign(s, {
        runs: r.runs,
        active: r.active,
        converted: r.converted,
        orders: r.converted,
        revenuePaise: r.revenue,
      })
  }
  for (const m of messages) {
    const s = m.id ? out.get(m.id) : undefined
    if (s) Object.assign(s, { sent: m.sent, opened: m.opened, clicked: m.clicked })
  }
  return out
}

export type AutomationListItem = AutomationRow & { stats: AutomationStats }

export async function listAutomations(tx: StoreTx): Promise<AutomationListItem[]> {
  const rows = await tx
    .select()
    .from(marketingAutomation)
    .orderBy(desc(marketingAutomation.createdAt))
  const stats = await automationStats(
    tx,
    rows.map((r) => r.id),
  )
  return rows.map((r) => ({ ...r, stats: stats.get(r.id) ?? { ...EMPTY } }))
}

// ---------------------------------------------------------------------------
// Enrolment

type Enrolment = {
  triggerKey: string
  customerId?: string | null | undefined
  cartId?: string | null | undefined
  orderId?: string | null | undefined
  email?: string | null | undefined
  phone?: string | null | undefined
  name?: string | null | undefined
}

async function activeAutomations(tx: StoreTx, trigger: AutomationTrigger) {
  return tx
    .select()
    .from(marketingAutomation)
    .where(and(eq(marketingAutomation.trigger, trigger), eq(marketingAutomation.status, 'active')))
}

/** Idempotent: the same trigger key never enrols twice in one automation. */
async function enrol(
  tx: StoreTx,
  storeId: string,
  automation: AutomationRow,
  e: Enrolment,
  now: Date,
): Promise<boolean> {
  const rows = await tx
    .insert(marketingAutomationRun)
    .values({
      storeId,
      automationId: automation.id,
      triggerKey: e.triggerKey,
      customerId: e.customerId ?? null,
      cartId: e.cartId ?? null,
      orderId: e.orderId ?? null,
      email: e.email?.trim().toLowerCase() || null,
      phone: e.phone ?? null,
      name: e.name ?? null,
      startedAt: now,
      nextAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: marketingAutomationRun.id })
  return rows.length > 0
}

const lineCount = sql<number>`(select count(*)::int from cart_line cl where cl.cart_id = cart.id)`

/**
 * Enrols shoppers the sweep can see: quiet baskets (with a checkout contact,
 * or signed-in shoppers who never reached checkout) and customers whose
 * last order was `lapsedDays` ago. Event triggers enrol from the storefront.
 */
export async function enrolDue(
  tx: StoreTx,
  storeId: string,
  secret: string,
  now = new Date(),
): Promise<number> {
  // Stores moved onto the Automations engine are enrolled by its sweep triggers.
  if (!(await legacyOwnsStore(tx, storeId))) return 0
  let enrolled = 0
  for (const a of await activeAutomations(tx, 'checkout_abandoned')) {
    const after = parseAutomationSettings(a.settings).afterMinutes ?? 60
    const carts = await tx
      .select({
        id: cart.id,
        email: cart.email,
        phone: cart.phone,
        name: cart.customerName,
        customerId: cart.customerId,
      })
      .from(cart)
      .where(
        and(
          eq(cart.status, 'open'),
          sql`(${cart.email} is not null or ${cart.phone} is not null)`,
          // Baskets the old recovery sweep already nudged are not nudged again.
          isNull(cart.recoverySentAt),
          lte(cart.updatedAt, new Date(now.getTime() - after * 60_000)),
          sql`${cart.updatedAt} > ${new Date(now.getTime() - ABANDONED_LOOKBACK_DAYS * DAY_MS).toISOString()}::timestamptz`,
          sql`${lineCount} > 0`,
        ),
      )
      .limit(200)
    for (const c of carts) {
      const customerId = c.customerId ?? (await customerIdByEmail(tx, c.email))
      if (
        await enrol(
          tx,
          storeId,
          a,
          {
            triggerKey: `cart:${c.id}`,
            cartId: c.id,
            customerId,
            email: c.email,
            phone: c.phone,
            name: c.name,
          },
          now,
        )
      )
        enrolled += 1
    }
  }

  for (const a of await activeAutomations(tx, 'cart_abandoned')) {
    const after = parseAutomationSettings(a.settings).afterMinutes ?? 120
    const carts = await tx
      .select({
        id: cart.id,
        customerId: customer.id,
        email: customer.email,
        phone: customer.phone,
        name: customer.name,
      })
      .from(cart)
      .innerJoin(customer, eq(customer.id, cart.customerId))
      .where(
        and(
          eq(cart.status, 'open'),
          isNull(cart.email),
          isNull(cart.phone),
          lte(cart.updatedAt, new Date(now.getTime() - after * 60_000)),
          sql`${cart.updatedAt} > ${new Date(now.getTime() - ABANDONED_LOOKBACK_DAYS * DAY_MS).toISOString()}::timestamptz`,
          sql`${lineCount} > 0`,
        ),
      )
      .limit(200)
    for (const c of carts) {
      const phone = decryptCustomerPhone(c.phone, secret)
      if (
        await enrol(tx, storeId, a, { triggerKey: `cart:${c.id}`, cartId: c.id, ...c, phone }, now)
      ) {
        enrolled += 1
      }
    }
  }

  for (const a of await activeAutomations(tx, 'customer_lapsed')) {
    const days = parseAutomationSettings(a.settings).lapsedDays ?? 90
    const cutoff = new Date(now.getTime() - days * DAY_MS)
    const floor = new Date(cutoff.getTime() - 7 * DAY_MS)
    // The latest order decides; if that order was imported the customer is not
    // enrolled, because imported history must never trigger automations.
    const lapsed = await tx.execute<{
      customer_id: string
      order_id: string
      email: string | null
      phone: string | null
      name: string | null
    }>(sql`
      select distinct on (o.customer_id) o.customer_id, o.id as order_id, c.email, c.phone, c.name, o.imported_from, o.placed_at
      from "order" o join customer c on c.id = o.customer_id
      where o.status not in ('draft', 'cancelled')
      order by o.customer_id, o.placed_at desc`)
    for (const r of lapsed as unknown as {
      customer_id: string
      order_id: string
      email: string | null
      phone: string | null
      name: string | null
      imported_from: string | null
      placed_at: string | Date
    }[]) {
      const at = new Date(r.placed_at)
      if (r.imported_from || at > cutoff || at < floor) continue
      if (
        await enrol(
          tx,
          storeId,
          a,
          {
            triggerKey: `lapsed:${r.order_id}`,
            customerId: r.customer_id,
            email: r.email,
            phone: decryptCustomerPhone(r.phone, secret),
            name: r.name,
          },
          now,
        )
      )
        enrolled += 1
    }
  }
  return enrolled
}

async function customerIdByEmail(tx: StoreTx, email: string | null): Promise<string | null> {
  if (!email) return null
  const [c] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(eq(customer.email, email.trim().toLowerCase()))
  return c?.id ?? null
}

/** A newsletter signup: starts the welcome automations, once per customer. */
export async function enrolSubscriber(
  tx: StoreTx,
  storeId: string,
  email: string,
  secret: string,
  now = new Date(),
): Promise<number> {
  const legacy = await legacyOwnsStore(tx, storeId)
  const [c] = await tx.select().from(customer).where(eq(customer.email, email.trim().toLowerCase()))
  if (!c) return 0
  if (!legacy) {
    // On the engine the welcome trigger is an outbox event (keyed per customer by the engine).
    await insertOutboxEvent(tx, storeId, 'customer.subscribed', { customerId: c.id })
    return 0
  }
  let n = 0
  for (const a of await activeAutomations(tx, 'customer_subscribed')) {
    const ok = await enrol(
      tx,
      storeId,
      a,
      {
        triggerKey: `subscribed:${c.id}`,
        customerId: c.id,
        email: c.email,
        phone: decryptCustomerPhone(c.phone, secret),
        name: c.name,
      },
      now,
    )
    if (ok) n += 1
  }
  return n
}

/**
 * After an order is placed: end the sequences it converts (abandoned
 * checkout, win-back, welcome) and start the order automations (first
 * purchase, COD confirmation). Imported orders do neither.
 */
export async function onOrderPlaced(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  now = new Date(),
): Promise<{ converted: number; enrolled: number }> {
  const legacy = await legacyOwnsStore(tx, storeId)
  const [o] = await tx.select().from(order).where(eq(order.id, orderId))
  if (!o || o.importedFrom || o.status === 'draft') return { converted: 0, enrolled: 0 }
  // On the engine the order triggers come from the outbox; only the conversion credit is here.
  if (!legacy) return { converted: await markEngineConversions(tx, o, now), enrolled: 0 }
  const converted = await markConversions(tx, o, now)
  let enrolled = 0
  const [cu] = o.customerId
    ? await tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const base = {
    customerId: o.customerId,
    orderId: o.id,
    email: o.email,
    phone: o.phone,
    name: cu?.name ?? null,
  }
  if (o.customerId) {
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(order)
      .where(
        and(
          eq(order.customerId, o.customerId),
          sql`${order.status} not in ('draft', 'cancelled')`,
          isNull(order.importedFrom),
        ),
      )
    if (n === 1) {
      for (const a of await activeAutomations(tx, 'first_order')) {
        if (await enrol(tx, storeId, a, { ...base, triggerKey: `order:${o.id}` }, now))
          enrolled += 1
      }
    }
  }
  if (o.paymentMethod === 'cod') {
    for (const a of await activeAutomations(tx, 'cod_order_placed')) {
      if (await enrol(tx, storeId, a, { ...base, triggerKey: `order:${o.id}` }, now)) enrolled += 1
    }
  }
  return { converted, enrolled }
}

type OrderRow = typeof order.$inferSelect

/** Runs this order converts: same cart, customer or email, started before it, still in the window. */
async function markConversions(tx: StoreTx, o: OrderRow, now: Date): Promise<number> {
  const stopping = Object.entries(STOPS_ON_ORDER)
    .filter(([, stops]) => stops)
    .map(([t]) => t)
  const since = new Date(now.getTime() - CONVERSION_WINDOW_DAYS * DAY_MS)
  const who = [
    o.customerId ? sql`${marketingAutomationRun.customerId} = ${o.customerId}` : null,
    o.email ? sql`${marketingAutomationRun.email} = ${o.email.trim().toLowerCase()}` : null,
    sql`${marketingAutomationRun.cartId} in (select id from cart where status = 'converted')`,
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  const rows = await tx
    .update(marketingAutomationRun)
    .set({ status: 'converted', convertedOrderId: o.id, finishedAt: now, stopReason: null })
    .where(
      and(
        inArray(marketingAutomationRun.status, ['active', 'completed']),
        sql`${marketingAutomationRun.startedAt} <= ${o.placedAt.toISOString()}::timestamptz`,
        sql`${marketingAutomationRun.startedAt} >= ${since.toISOString()}::timestamptz`,
        sql`${marketingAutomationRun.automationId} in (select id from marketing_automation where "trigger" in (${sql.join(
          stopping.map((t) => sql`${t}`),
          sql`, `,
        )}))`,
        sql`(${sql.join(who, sql` or `)})`,
      ),
    )
    .returning({ id: marketingAutomationRun.id })
  return rows.length
}

// ---------------------------------------------------------------------------
// Running

type Context = {
  automation: AutomationRow
  steps: AutomationStep[]
}

/** The cart as the abandoned-cart email shows it: lines with image and price label, total, status. */
export async function cartFacts(tx: StoreTx, cartId: string) {
  const [c] = await tx.select({ status: cart.status }).from(cart).where(eq(cart.id, cartId))
  const lines = await tx.execute<{
    title: string
    variant_title: string
    quantity: number
    unit_price_paise: number
    image_url: string | null
  }>(sql`
    select p.title, v.title as variant_title, cl.quantity, cl.unit_price_paise,
      (select m.url from product_media pm join media m on m.id = pm.media_id
        where pm.product_id = p.id order by pm.position limit 1) as image_url
    from cart_line cl join variant v on v.id = cl.variant_id join product p on p.id = v.product_id
    where cl.cart_id = ${cartId}`)
  const list = lines as unknown as {
    title: string
    variant_title: string
    quantity: number
    unit_price_paise: number
    image_url: string | null
  }[]
  const total = list.reduce((n, l) => n + l.quantity * l.unit_price_paise, 0)
  const emailLines: EmailCartLine[] = list.map((l) => ({
    title: [
      l.title,
      l.variant_title && l.variant_title !== 'Default' && l.variant_title !== 'Default Title'
        ? l.variant_title
        : null,
    ]
      .filter(Boolean)
      .join(' / '),
    quantity: l.quantity,
    priceLabel: formatMoney(l.quantity * l.unit_price_paise),
    imageUrl: l.image_url,
  }))
  return { status: c?.status ?? null, totalPaise: total, lines: emailLines }
}

async function conversionFor(tx: StoreTx, run: RunRow): Promise<string | null> {
  const who = [
    run.customerId ? sql`o.customer_id = ${run.customerId}` : null,
    run.email ? sql`lower(o.email) = ${run.email}` : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  if (who.length === 0) return null
  const rows = (await tx.execute<{ id: string }>(sql`
    select o.id from "order" o
    where (${sql.join(who, sql` or `)})
      and o.status not in ('draft', 'cancelled') and o.imported_from is null
      and o.placed_at >= ${run.startedAt.toISOString()}::timestamptz
    order by o.placed_at limit 1`)) as unknown as { id: string }[]
  return rows[0]?.id ?? null
}

async function finish(
  tx: StoreTx,
  runId: string,
  patch: Partial<typeof marketingAutomationRun.$inferInsert>,
) {
  await tx
    .update(marketingAutomationRun)
    .set({ finishedAt: new Date(), ...patch })
    .where(eq(marketingAutomationRun.id, runId))
}

/**
 * Advances every due run: checks whether the shopper already converted (then
 * the sequence stops), then executes steps until a wait or the end. Sends go
 * through the store's marketing channels; a step with no reachable address
 * or no consent is skipped rather than failing the run.
 */
export async function processDueRuns(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
  now = new Date(),
): Promise<{ processed: number; sent: number }> {
  if (!(await legacyOwnsStore(tx, storeId))) return { processed: 0, sent: 0 }
  const due = await tx
    .select({ run: marketingAutomationRun })
    .from(marketingAutomationRun)
    .innerJoin(marketingAutomation, eq(marketingAutomation.id, marketingAutomationRun.automationId))
    .where(
      and(
        eq(marketingAutomationRun.status, 'active'),
        eq(marketingAutomation.status, 'active'),
        lte(marketingAutomationRun.nextAt, now),
      ),
    )
    .orderBy(asc(marketingAutomationRun.nextAt))
    .limit(RUNS_PER_TICK)
    .for('update', { of: marketingAutomationRun, skipLocked: true })
  if (due.length === 0) return { processed: 0, sent: 0 }

  const contexts = new Map<string, Context>()
  const channels = await marketingChannels(tx, storeId, deps)
  const sender = await storeSender(tx, storeId)
  let sent = 0

  for (const { run } of due) {
    let ctx = contexts.get(run.automationId)
    if (!ctx) {
      const a = await getAutomation(tx, run.automationId)
      if (!a) continue
      ctx = {
        automation: a,
        steps: parseAutomationSteps(a.steps),
      }
      contexts.set(a.id, ctx)
    }
    const trigger = ctx.automation.trigger as AutomationTrigger

    if (STOPS_ON_ORDER[trigger]) {
      const converted = await conversionFor(tx, run)
      if (converted) {
        await finish(tx, run.id, { status: 'converted', convertedOrderId: converted })
        continue
      }
    }
    const cuRow = run.customerId
      ? (await tx.select().from(customer).where(eq(customer.id, run.customerId)))[0]
      : undefined
    const cu = cuRow
      ? { ...cuRow, phone: decryptCustomerPhone(cuRow.phone, deps.settingsSecret) }
      : undefined
    // An unsubscribed customer still gets the COD confirmation (an order
    // update), never anything after it.
    if (cu?.unsubscribedAt && !isTransactionalStep(trigger, ctx.steps, run.stepIndex)) {
      await finish(tx, run.id, { status: 'stopped', stopReason: 'unsubscribed' })
      continue
    }
    const cartInfo = run.cartId ? await cartFacts(tx, run.cartId) : null
    if (cartInfo && cartInfo.status === 'converted') {
      await finish(tx, run.id, { status: 'converted' })
      continue
    }
    const [o] = run.orderId ? await tx.select().from(order).where(eq(order.id, run.orderId)) : []
    const merge: MergeValues = {
      first_name: firstName(run.name ?? cu?.name),
      name: run.name ?? cu?.name ?? '',
      store_name: sender.storeName,
      shop_url: deps.storefrontUrl,
      checkout_url: run.cartId
        ? recoveryUrl(run.cartId, deps.settingsSecret, deps.storefrontUrl)
        : deps.storefrontUrl,
      cart_total: cartInfo ? formatMoney(cartInfo.totalPaise) : o ? formatMoney(o.totalPaise) : '',
      order_number: o ? `#${o.number}` : '',
    }

    const sentBefore = sent
    let index = run.stepIndex
    let next: Date | null = null
    let stopped: string | null = null
    while (index < ctx.steps.length) {
      const step = ctx.steps[index] as AutomationStep
      if (step.type === 'wait') {
        next = new Date(now.getTime() + step.minutes * 60_000)
        index += 1
        break
      }
      if (step.type === 'condition') {
        const facts = {
          cartValuePaise: cartInfo ? cartInfo.totalPaise : o ? o.totalPaise : null,
          orderCount: cu ? await orderCount(tx, cu.id) : 0,
          acceptsMarketing: cu?.acceptsMarketing ?? false,
        }
        if (!conditionHolds(step, facts)) {
          stopped = 'condition'
          break
        }
        index += 1
        continue
      }
      if (step.type === 'email') {
        const email = run.email ?? cu?.email ?? null
        const consented = hasMarketingConsent(cu, 'email')
        if (email && consented && channels.email) {
          const id = await messageFor(tx, storeId, run, index, 'email', email)
          // Consent is the customer's; the typed checkout email may be someone else's.
          if (id && !recipientIsCustomers('email', email, cu)) {
            await skipMessage(tx, id, RECIPIENT_MISMATCH)
          } else if (id) {
            const discount = step.blocks.find((b) => b.type === 'discount')
            // "A unique code for each shopper": made now, single use, for this customer only.
            const personal =
              discount?.type === 'discount' && discount.unique
                ? await issuePersonalCode(tx, storeId, {
                    messageId: id,
                    prefix: ctx.automation.name.split(/\s+/)[0] ?? 'THANKS',
                    offer: discount.unique,
                    customerId: cu?.id ?? null,
                    title: ctx.automation.name,
                    now,
                  })
                : null
            const blocks = personal
              ? step.blocks.map((b) => (b.type === 'discount' ? { ...b, code: personal } : b))
              : step.blocks
            const stepMerge = {
              ...merge,
              discount_code: personal ?? (discount?.type === 'discount' ? discount.code : ''),
            }
            const r = await sendMarketingEmail(tx, storeId, deps, channels.email, sender, {
              messageId: id,
              to: email,
              customerId: cu?.id ?? null,
              subject: applyMergeTags(step.subject, stepMerge),
              previewText: step.previewText,
              blocks,
              merge: stepMerge,
              cart: cartInfo
                ? { lines: cartInfo.lines, totalLabel: formatMoney(cartInfo.totalPaise) }
                : undefined,
              utmCampaign: `automation-${ctx.automation.template}`,
            })
            if (r.ok) sent += 1
          }
        }
        index += 1
        continue
      }
      // WhatsApp
      const phone = normalisePhone(run.phone ?? cu?.phone)
      const transactional = isTransactionalStep(trigger, ctx.steps, index)
      const consented = transactional || hasMarketingConsent(cu, 'whatsapp')
      if (phone && consented && channels.whatsapp) {
        const id = await messageFor(tx, storeId, run, index, 'whatsapp', phone)
        // The COD confirmation goes to the order's own phone; marketing only
        // to the phone stored on the consenting customer, never a typed one.
        if (id && !transactional && !recipientIsCustomers('phone', phone, cu)) {
          await skipMessage(tx, id, RECIPIENT_MISMATCH)
        } else if (id) {
          const r = await sendMarketingWhatsapp(
            tx,
            channels.whatsapp,
            {
              messageId: id,
              to: phone,
              customerId: cu?.id ?? null,
              transactional,
              template: step.template,
              merge,
            },
            applyMergeTags,
          )
          if (r.ok) sent += 1
        }
      }
      index += 1
    }

    if (stopped) {
      await finish(tx, run.id, { status: 'stopped', stopReason: stopped, stepIndex: index })
    } else if (next) {
      await tx
        .update(marketingAutomationRun)
        .set({ stepIndex: index, nextAt: next })
        .where(eq(marketingAutomationRun.id, run.id))
    } else {
      await finish(tx, run.id, { status: 'completed', stepIndex: index })
    }
    // Keep the legacy flag in step so the abandoned-checkout list shows the nudge.
    if (run.cartId && sent > sentBefore) {
      await tx
        .update(cart)
        .set({ recoverySentAt: sql`coalesce(${cart.recoverySentAt}, now())` })
        .where(eq(cart.id, run.cartId))
    }
  }
  return { processed: due.length, sent }
}

async function orderCount(tx: StoreTx, customerId: string): Promise<number> {
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(
      and(eq(order.customerId, customerId), sql`${order.status} not in ('draft', 'cancelled')`),
    )
  return r?.n ?? 0
}

async function skipMessage(tx: StoreTx, messageId: string, reason: string) {
  await tx
    .update(marketingMessage)
    .set({ status: 'skipped', error: reason })
    .where(eq(marketingMessage.id, messageId))
}

/** One message row per run step; a retried step finds its row and does not send twice. */
async function messageFor(
  tx: StoreTx,
  storeId: string,
  run: RunRow,
  stepIndex: number,
  channel: string,
  to: string,
): Promise<string | null> {
  const [row] = await tx
    .insert(marketingMessage)
    .values({
      storeId,
      automationId: run.automationId,
      runId: run.id,
      stepIndex,
      customerId: run.customerId,
      channel,
      to,
    })
    .onConflictDoNothing()
    .returning({ id: marketingMessage.id })
  return row?.id ?? null
}

/** Recent runs for the automation page. */
export async function recentRuns(tx: StoreTx, automationId: string, limit = 20) {
  return tx
    .select({
      id: marketingAutomationRun.id,
      email: marketingAutomationRun.email,
      phone: marketingAutomationRun.phone,
      name: marketingAutomationRun.name,
      status: marketingAutomationRun.status,
      stepIndex: marketingAutomationRun.stepIndex,
      nextAt: marketingAutomationRun.nextAt,
      stopReason: marketingAutomationRun.stopReason,
      startedAt: marketingAutomationRun.startedAt,
      finishedAt: marketingAutomationRun.finishedAt,
    })
    .from(marketingAutomationRun)
    .where(eq(marketingAutomationRun.automationId, automationId))
    .orderBy(desc(marketingAutomationRun.startedAt))
    .limit(limit)
}
