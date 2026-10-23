/** SOURCE OF TRUTH: run subject labels — WHAT: what the run log, approvals and record history call a run's subject ("#1042", "Asha Rao", "Cotton kurta") / WHY: every run view names records the same way, in one batched lookup per page. */
import { type automationRun, customer, order, product, type StoreTx } from '@commerce/db'
import { inArray } from 'drizzle-orm'
import type { SubjectLabel } from '../api-types'

type RunRow = typeof automationRun.$inferSelect

/** "#1042", "Asha Rao", "Cotton kurta": what the run log calls each subject. */
export async function subjectLabels(
  tx: StoreTx,
  runs: Pick<RunRow, 'subjectType' | 'subjectId'>[],
) {
  const ids = (type: string) => [
    ...new Set(
      runs.filter((r) => r.subjectType === type && r.subjectId).map((r) => r.subjectId as string),
    ),
  ]
  const labels = new Map<string, string>()
  const orderIds = ids('order')
  if (orderIds.length) {
    for (const o of await tx
      .select({ id: order.id, number: order.number })
      .from(order)
      .where(inArray(order.id, orderIds)))
      labels.set(o.id, `#${o.number}`)
  }
  const customerIds = ids('customer')
  if (customerIds.length) {
    for (const c of await tx
      .select({ id: customer.id, name: customer.name, email: customer.email })
      .from(customer)
      .where(inArray(customer.id, customerIds)))
      labels.set(c.id, c.name || c.email || 'Customer')
  }
  const productIds = ids('product')
  if (productIds.length) {
    for (const p of await tx
      .select({ id: product.id, title: product.title })
      .from(product)
      .where(inArray(product.id, productIds)))
      labels.set(p.id, p.title)
  }
  return (r: Pick<RunRow, 'subjectType' | 'subjectId'>): SubjectLabel => ({
    type: r.subjectType,
    id: r.subjectId,
    label: r.subjectId ? (labels.get(r.subjectId) ?? 'Deleted record') : '',
  })
}
