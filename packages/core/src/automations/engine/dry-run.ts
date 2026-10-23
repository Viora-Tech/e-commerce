/** SOURCE OF TRUTH: automation dry run — WHAT: "Test with a record": walks a definition against a real record with conditions on live data and actions' `preview()`, waits shown and skipped, writing nothing / WHY: the editor's Test, the Run automation dialog's "This will…" and the publish nudge read one walker that cannot change the store (design §8.7). */
import type { StoreTx } from '@commerce/db'
import { TransactionRollbackError } from 'drizzle-orm'
import type { TestRunResult, TestStep } from '../api-types'
import { nodeNeedsApproval } from '../catalogue'
import type { WorkflowDefinition, WorkflowNode } from '../definition'
import type { ActionContext, RunSubject, SubjectData } from '../executor'
import { renderMergeTags } from '../merge-tags'
import type { EngineDeps, ResolvedAction } from './interpreter'
import { findRecords } from './loops'

export type DryRunDeps = Pick<EngineDeps, 'evaluate' | 'loadSubject'> & {
  resolveAction: (tx: StoreTx, storeId: string, id: string) => Promise<ResolvedAction | null>
}

/** Runs `fn` in a savepoint that is always rolled back, so a preview can never change the store. */
async function rolledBack<T>(tx: StoreTx, fn: (sp: StoreTx) => Promise<T>): Promise<T> {
  let out: { value: T } | null = null
  try {
    await tx.transaction(async (sp) => {
      out = { value: await fn(sp) }
      sp.rollback()
    })
  } catch (err) {
    if (!(err instanceof TransactionRollbackError)) throw err
  }
  if (!out) throw new Error('preview did not finish')
  return (out as { value: T }).value
}

/** Walks `def` for `subject`. A label for the subject is the caller's (it knows the record). */
export async function dryRun(
  tx: StoreTx,
  storeId: string,
  input: {
    workflow: { id: string; name: string }
    def: WorkflowDefinition
    subject: RunSubject | null
  },
  deps: DryRunDeps,
): Promise<TestRunResult> {
  const subject = input.subject ?? { type: 'none', id: null }
  const loaded = subject.id ? await deps.loadSubject(tx, storeId, subject) : {}
  if (!loaded)
    return { subject: null, steps: [], path: [], blocked: 'This record no longer exists' }
  let data: SubjectData = { ...loaded, trigger: {} }
  const found = new Map<string, { resource: string; ids: string[] }>()
  // Inside a For each: where to go once the body branch ends, and the data to go back to.
  let afterLoop: { next: string | null; data: SubjectData } | null = null

  const steps: TestStep[] = []
  const path: string[] = []
  let cursor = input.def.start
  const seen = new Set<string>()
  for (;;) {
    if (!cursor && afterLoop) {
      cursor = afterLoop.next
      data = afterLoop.data
      afterLoop = null
    }
    if (!cursor || seen.has(cursor)) break
    seen.add(cursor)
    const node: WorkflowNode | undefined = input.def.nodes[cursor]
    if (!node) break
    path.push(node.id)
    if (node.kind === 'find') {
      const r = await findRecords(tx, storeId, node, deps)
      found.set(node.id, { resource: node.resource, ids: r.ids })
      steps.push({
        nodeId: node.id,
        kind: 'find',
        actionId: null,
        status: 'would_run',
        summary: `Would find ${r.ids.length} ${node.resource}${r.ids.length === 1 ? '' : 's'}`,
        warnings: [],
        output: { ids: r.ids, scanned: r.scanned },
      })
      cursor = node.next
      continue
    }
    if (node.kind === 'forEach') {
      const source = found.get(node.source)
      const first = source?.ids[0]
      const itemData = first
        ? await deps.loadSubject(tx, storeId, { type: source.resource, id: first })
        : null
      steps.push({
        nodeId: node.id,
        kind: 'forEach',
        actionId: null,
        status: first ? 'would_run' : 'would_skip',
        summary: first
          ? `Would repeat for ${source.ids.length} records (the test shows the first)`
          : 'Would repeat for no records',
        warnings: [],
        output: { count: source?.ids.length ?? 0 },
      })
      if (first && itemData && node.body) {
        afterLoop = { next: node.next, data }
        data = { ...data, ...itemData }
        cursor = node.body
      } else cursor = node.next
      continue
    }
    if (node.kind === 'wait') {
      steps.push({
        nodeId: node.id,
        kind: 'wait',
        actionId: null,
        status: 'would_wait',
        summary: `Would wait ${node.minutes} minutes (skipped in a test)`,
        warnings: [],
        output: { minutes: node.minutes },
      })
      cursor = node.next
      continue
    }
    if (node.kind === 'condition') {
      const r = deps.evaluate(node.rules, data)
      steps.push({
        nodeId: node.id,
        kind: 'condition',
        actionId: null,
        status: r.pass ? 'then' : 'otherwise',
        summary: r.pass ? 'Conditions met: Then' : 'Conditions not met: Otherwise',
        warnings: [],
        output: { trace: r.trace },
      })
      cursor = r.pass ? node.next : node.otherwise
      continue
    }
    const resolved = await deps.resolveAction(tx, storeId, node.action)
    if (!resolved) {
      steps.push({
        nodeId: node.id,
        kind: 'action',
        actionId: node.action,
        status: 'error',
        summary: 'This action is not available',
        warnings: [],
        output: null,
      })
      if (node.onError === 'stop') break
      cursor = node.next
      continue
    }
    const parsed = resolved.descriptor.configSchema.safeParse(node.config)
    if (!parsed.success) {
      steps.push({
        nodeId: node.id,
        kind: 'action',
        actionId: node.action,
        status: 'error',
        summary: 'This step is not filled in correctly',
        warnings: [],
        output: null,
      })
      if (node.onError === 'stop') break
      cursor = node.next
      continue
    }
    const ctx: ActionContext = {
      storeId,
      workflow: { id: input.workflow.id, name: input.workflow.name, versionId: 'draft' },
      runId: null,
      nodeId: node.id,
      iteration: 0,
      stepKey: `test:${node.id}`,
      attempt: 1,
      subject,
      data,
      triggerData: {},
      cause: null,
      dryRun: true,
      render: (template) => renderMergeTags(template, data),
      log: () => {},
    }
    try {
      const preview = await rolledBack(tx, (sp) =>
        resolved.executor.preview({ tx: sp, ctx, config: parsed.data }),
      )
      const asks = nodeNeedsApproval(resolved.descriptor, node.needsApproval)
      steps.push({
        nodeId: node.id,
        kind: 'action',
        actionId: node.action,
        status: asks ? 'would_ask' : preview.wouldRun ? 'would_run' : 'would_skip',
        summary: asks ? `${preview.summary} (asks for approval first)` : preview.summary,
        warnings: preview.warnings ?? [],
        output: preview.output ?? null,
      })
    } catch (err) {
      steps.push({
        nodeId: node.id,
        kind: 'action',
        actionId: node.action,
        status: 'error',
        summary: err instanceof Error ? err.message : String(err),
        warnings: [],
        output: null,
      })
      if (node.onError === 'stop') break
    }
    cursor = node.next
  }
  return {
    subject: subject.id ? { type: subject.type, id: subject.id, label: subject.id } : null,
    steps,
    path,
    blocked: null,
  }
}
