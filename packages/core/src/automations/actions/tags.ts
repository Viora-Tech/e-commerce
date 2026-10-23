/** SOURCE OF TRUTH: tag automation actions — WHAT: add/remove tags on the run's order, customer (an order's or cart's customer too) or product, idempotent (a tag already there is a no-op that writes nothing), with a timeline note on orders and loop-guarded change events for customers and products / WHY: the most common Flow step; tags match without regard to case like the admin's tag editors (customer tags are stored lower-case, as `tagCustomers` does). Server-only. Design §8.4. */
import { customer, order, product, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { noteProductsChanged } from '../../catalog/changes'
import { insertOutboxEvent } from '../../outbox/write'
import { customerIdOf } from '../conditions/loaders'
import type { ActionContext, ActionExecutor, ActionPreview, ActionResult } from '../executor'
import {
  gone,
  noteOnOrder,
  planTags,
  renderTags,
  subjectId,
  type TagPlan,
  tagPreview,
} from './shared'

type Config = { tags: string[] }
type Mode = 'add' | 'remove'

/** Most tags one order carries (the order page's tag field allows the same). */
const MAX_ORDER_TAGS = 20

/** One resource's tag storage: read the current list, write the new one with its side effects. */
type TagTarget = {
  what: string
  lowerCase: boolean
  max?: number
  /** The record to tag, or null when the subject has none (a guest order's customer). */
  recordId(tx: StoreTx, ctx: ActionContext): Promise<string | null>
  read(tx: StoreTx, id: string): Promise<string[] | null>
  write(
    tx: StoreTx,
    ctx: ActionContext,
    id: string,
    plan: TagPlan,
    mode: Mode,
  ): Promise<ActionResult['changed']>
}

const orderTarget: TagTarget = {
  what: 'order',
  lowerCase: false,
  max: MAX_ORDER_TAGS,
  recordId: async (_tx, ctx) => subjectId(ctx, 'an order'),
  async read(tx, id) {
    const [o] = await tx.select({ tags: order.tags }).from(order).where(eq(order.id, id))
    return o ? (o.tags ?? []) : null
  },
  async write(tx, ctx, id, plan, mode) {
    await tx.update(order).set({ tags: plan.next }).where(eq(order.id, id))
    const word = plan.changed.length > 1 ? 'Tags' : 'Tag'
    await noteOnOrder(
      tx,
      ctx,
      id,
      `${word} ${plan.changed.join(', ')} ${mode === 'add' ? 'added' : 'removed'}`,
    )
    return undefined
  },
}

const customerTarget: TagTarget = {
  what: 'customer',
  lowerCase: true,
  recordId: (tx, ctx) => customerIdOf(tx, ctx.subject),
  async read(tx, id) {
    const [c] = await tx.select({ tags: customer.tags }).from(customer).where(eq(customer.id, id))
    return c ? c.tags : null
  },
  async write(tx, ctx, id, plan, mode) {
    await tx
      .update(customer)
      .set({ tags: plan.next, updatedAt: new Date() })
      .where(eq(customer.id, id))
    await insertOutboxEvent(
      tx,
      ctx.storeId,
      'customer.tags_changed',
      {
        customerId: id,
        tagsAdded: mode === 'add' ? plan.changed : [],
        tagsRemoved: mode === 'remove' ? plan.changed : [],
      },
      { cause: ctx.cause },
    )
    return ctx.subject.type === 'customer' ? undefined : [{ type: 'customer', id }]
  },
}

const productTarget: TagTarget = {
  what: 'product',
  lowerCase: false,
  recordId: async (_tx, ctx) => subjectId(ctx, 'a product'),
  async read(tx, id) {
    const [p] = await tx.select({ tags: product.tags }).from(product).where(eq(product.id, id))
    return p ? p.tags : null
  },
  async write(tx, ctx, id, plan) {
    await tx
      .update(product)
      .set({ tags: plan.next, updatedAt: new Date() })
      .where(eq(product.id, id))
    await noteProductsChanged(tx, [id], ctx.storeId)
    await insertOutboxEvent(
      tx,
      ctx.storeId,
      'product.updated',
      { productId: id },
      { cause: ctx.cause },
    )
    return undefined
  },
}

async function planFor(
  target: TagTarget,
  mode: Mode,
  tx: StoreTx,
  ctx: ActionContext,
  config: Config,
): Promise<{ id: string; plan: TagPlan } | null> {
  const id = await target.recordId(tx, ctx)
  if (!id) return null
  const current = await target.read(tx, id)
  if (!current) throw gone(target.what)
  return {
    id,
    plan: planTags(current, renderTags(ctx, config.tags, target.lowerCase), mode, target.max),
  }
}

function tagExecutor(actionId: string, target: TagTarget, mode: Mode): ActionExecutor<Config> {
  return {
    id: actionId,
    async run({ tx, ctx, config }): Promise<ActionResult> {
      const planned = await planFor(target, mode, tx, ctx, config)
      if (!planned) {
        return { noop: true, summary: `No ${target.what} to tag`, output: { tags: [] } }
      }
      const { id, plan } = planned
      if (plan.changed.length === 0) {
        return {
          noop: true,
          summary: mode === 'add' ? 'Tags already there' : 'Tags were not there',
          output: { tags: [] },
        }
      }
      const changed = await target.write(tx, ctx, id, plan, mode)
      return {
        summary: `${mode === 'add' ? 'Added' : 'Removed'} tags ${plan.changed.join(', ')}`,
        output: { tags: plan.changed },
        changed,
      }
    },
    async preview({ tx, ctx, config }): Promise<ActionPreview> {
      const planned = await planFor(target, mode, tx, ctx, config)
      if (!planned) return { summary: `No ${target.what} to tag`, wouldRun: false }
      return tagPreview(planned.plan, mode)
    },
  }
}

export const tagExecutors = (): ActionExecutor<Config>[] => [
  tagExecutor('order.add_tags', orderTarget, 'add'),
  tagExecutor('order.remove_tags', orderTarget, 'remove'),
  tagExecutor('customer.add_tags', customerTarget, 'add'),
  tagExecutor('customer.remove_tags', customerTarget, 'remove'),
  tagExecutor('product.add_tags', productTarget, 'add'),
  tagExecutor('product.remove_tags', productTarget, 'remove'),
]
