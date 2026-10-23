/** SOURCE OF TRUTH: Find records and For each — WHAT: how a run looks up records (the newest of one kind matching the rules, at most 100) and walks a For each body once per record, with each pass's steps recorded under their own iteration / WHY: design phase 5 (Flow's "Get data" + "For each"); the loop state lives on the run row, so a crash resumes mid-loop at the record it was on. */
import { automationRun, customer, order, product, type StoreTx } from '@commerce/db'
import { and, desc, eq, ne } from 'drizzle-orm'
import type { FindNode, FindResource, ForEachNode, WorkflowDefinition } from '../definition'
import type { ConditionEvaluator, SubjectData, SubjectLoader } from '../executor'
import { moveTo, type RunLoop, type RunRow, type StepOutcome, stepRow, writeStep } from './steps'

/** Records a Find records step reads before it stops looking (newest first). */
const FIND_SCAN_LIMIT = 500

const loopOf = (run: Pick<RunRow, 'loop'>): RunLoop | null =>
  (run.loop as RunLoop | null) ?? null

/** The record the current pass is about, or null outside a loop. */
export const loopItem = (run: Pick<RunRow, 'loop'>) => {
  const loop = loopOf(run)
  return loop ? (loop.items[loop.index] ?? null) : null
}

async function candidateIds(tx: StoreTx, resource: FindResource): Promise<string[]> {
  if (resource === 'order') {
    const rows = await tx
      .select({ id: order.id })
      .from(order)
      .where(and(ne(order.status, 'draft'), eq(order.isTest, false)))
      .orderBy(desc(order.placedAt))
      .limit(FIND_SCAN_LIMIT)
    return rows.map((r) => r.id)
  }
  if (resource === 'customer') {
    const rows = await tx
      .select({ id: customer.id })
      .from(customer)
      .orderBy(desc(customer.id))
      .limit(FIND_SCAN_LIMIT)
    return rows.map((r) => r.id)
  }
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .orderBy(desc(product.id))
    .limit(FIND_SCAN_LIMIT)
  return rows.map((r) => r.id)
}

/**
 * The newest records of the node's kind whose data passes its rules, up to its limit. Reads at
 * most `FIND_SCAN_LIMIT` records, so a large store's Find stays cheap.
 */
export async function findRecords(
  tx: StoreTx,
  storeId: string,
  node: Pick<FindNode, 'resource' | 'rules' | 'limit'>,
  deps: { evaluate: ConditionEvaluator; loadSubject: SubjectLoader },
): Promise<{ ids: string[]; scanned: number }> {
  const ids: string[] = []
  let scanned = 0
  for (const id of await candidateIds(tx, node.resource)) {
    if (ids.length >= node.limit) break
    scanned += 1
    if (node.rules.rules.length === 0) {
      ids.push(id)
      continue
    }
    const data = await deps.loadSubject(tx, storeId, { type: node.resource, id })
    if (data && deps.evaluate(node.rules, data).pass) ids.push(id)
  }
  return { ids, scanned }
}

export async function doFind(
  tx: StoreTx,
  run: RunRow,
  node: FindNode,
  deps: { evaluate: ConditionEvaluator; loadSubject: SubjectLoader },
  now: Date,
): Promise<StepOutcome> {
  const { ids, scanned } = await findRecords(tx, run.storeId, node, deps)
  await writeStep(tx, run, node, null, {
    status: 'succeeded',
    output: { resource: node.resource, ids, scanned },
    summary: `Found ${ids.length} ${node.resource}${ids.length === 1 ? '' : 's'}`,
    startedAt: now,
    finishedAt: now,
  })
  return moveTo(tx, run.id, node.next)
}

/** Enters a For each: the source's records become the loop, the body runs for the first. */
export async function doForEach(
  tx: StoreTx,
  run: RunRow,
  node: ForEachNode,
  def: WorkflowDefinition,
  now: Date,
): Promise<StepOutcome> {
  const source = def.nodes[node.source]
  const found =
    source?.kind === 'find' ? await stepRow(tx, { ...run, loop: null }, source.id) : null
  const out = (found?.output ?? {}) as { ids?: string[] }
  const resource = source?.kind === 'find' ? source.resource : 'order'
  const items = (out.ids ?? []).map((id) => ({ type: resource, id }))
  await writeStep(tx, run, node, null, {
    status: 'succeeded',
    output: { count: items.length },
    summary: `For each of ${items.length}`,
    startedAt: now,
    finishedAt: now,
  })
  if (items.length === 0 || node.body === null) return moveTo(tx, run.id, node.next)
  const loop: RunLoop = { node: node.id, items, index: 0 }
  await tx
    .update(automationRun)
    .set({ loop, cursor: node.body, status: 'running' })
    .where(eq(automationRun.id, run.id))
  return { kind: 'continue' }
}

/** A body branch ended: the next record's pass, or out of the loop to the For each's `next`. */
export async function nextPass(
  tx: StoreTx,
  run: RunRow,
  def: WorkflowDefinition,
): Promise<StepOutcome> {
  const loop = loopOf(run)
  const node = loop ? def.nodes[loop.node] : null
  if (!loop || node?.kind !== 'forEach') {
    await tx.update(automationRun).set({ loop: null }).where(eq(automationRun.id, run.id))
    return { kind: 'continue' }
  }
  const more = loop.index + 1 < loop.items.length
  await tx
    .update(automationRun)
    .set(
      more
        ? { loop: { ...loop, index: loop.index + 1 }, cursor: node.body, status: 'running' }
        : { loop: null, cursor: node.next, status: 'running' },
    )
    .where(eq(automationRun.id, run.id))
  return { kind: 'continue' }
}

/** Subject data for a pass: the run's own, with the current record's on top. */
export async function withLoopItem(
  tx: StoreTx,
  run: RunRow,
  data: SubjectData,
  loadSubject: SubjectLoader,
): Promise<SubjectData | null> {
  const item = loopItem(run)
  if (!item) return data
  const own = await loadSubject(tx, run.storeId, item)
  return own ? { ...data, ...own } : null
}
