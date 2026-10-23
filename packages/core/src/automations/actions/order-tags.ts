/** SOURCE OF TRUTH: "Add order tags" automation action — WHAT: adds tags to the run's order (no-op when all are there) and previews it for dry runs / WHY: the example executor of the action contract; tags are merged case-insensitively like the order page's tag editor. */
import { order } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { type ActionExecutor, AutomationActionError } from '../executor'

type Config = { tags: string[] }

async function orderTags(tx: Parameters<ActionExecutor<Config>['run']>[0]['tx'], id: string) {
  const [o] = await tx.select({ tags: order.tags }).from(order).where(eq(order.id, id))
  if (!o) throw new AutomationActionError('The order no longer exists', { retryable: false })
  return o.tags ?? []
}

function plan(current: string[], wanted: string[]) {
  const have = new Set(current.map((t) => t.toLowerCase()))
  const add = [...new Set(wanted.map((t) => t.trim()).filter(Boolean))].filter(
    (t) => !have.has(t.toLowerCase()),
  )
  return { add, already: wanted.filter((t) => have.has(t.trim().toLowerCase())) }
}

export const addOrderTags: ActionExecutor<Config> = {
  id: 'order.add_tags',
  async run({ tx, ctx, config }) {
    if (!ctx.subject.id) throw new AutomationActionError('No order', { retryable: false })
    const current = await orderTags(tx, ctx.subject.id)
    const { add } = plan(
      current,
      config.tags.map((t) => ctx.render(t)),
    )
    if (add.length === 0)
      return { noop: true, summary: 'Tags already there', output: { added: [] } }
    await tx
      .update(order)
      .set({ tags: [...current, ...add] })
      .where(eq(order.id, ctx.subject.id))
    return { summary: `Added tags ${add.join(', ')}`, output: { added: add } }
  },
  async preview({ tx, ctx, config }) {
    if (!ctx.subject.id) return { summary: 'No order', wouldRun: false }
    const current = await orderTags(tx, ctx.subject.id)
    const { add, already } = plan(
      current,
      config.tags.map((t) => ctx.render(t)),
    )
    const parts = [
      add.length ? `Would add tags ${add.join(', ')}.` : 'Would add no tags.',
      already.length ? `Already has ${already.join(', ')}.` : '',
    ]
    return { summary: parts.filter(Boolean).join(' '), wouldRun: add.length > 0 }
  },
}
