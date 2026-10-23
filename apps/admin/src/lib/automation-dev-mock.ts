/**
 * DEV ONLY. In-memory stand-ins for the `automations.*` procedures while the engine's handlers
 * still answer NOT_IMPLEMENTED (they land in parallel, `packages/api/src/routers/automations.ts`).
 * `automation-api.ts` falls back to these only outside production and only on that error, so a
 * real handler always wins. Delete this file once every handler is implemented.
 */
import {
  type ApprovalItem,
  type AutomationUsage,
  BUILTIN_ACTIONS,
  BUILTIN_TEMPLATES,
  BUILTIN_TRIGGERS,
  type CatalogueView,
  CONDITION_FIELDS,
  emptyDefinition,
  type PublishResult,
  type RunDetail,
  type RunPage,
  type StepRunView,
  type TemplateView,
  type TestRunResult,
  type WorkflowDefinition,
  type WorkflowDetail,
  type WorkflowSummary,
  walkNodes,
} from '@commerce/core/automations'

const now = () => new Date().toISOString()
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const uuid = () => crypto.randomUUID()

const workflows = new Map<string, WorkflowDetail>()
const runs: RunDetail[] = []

function detail(
  name: string,
  definition: WorkflowDefinition,
  extra: Partial<WorkflowDetail> = {},
): WorkflowDetail {
  return {
    id: uuid(),
    name,
    description: '',
    status: 'off',
    origin: 'automations',
    templateId: null,
    triggerType: definition.trigger.type,
    hasDraft: true,
    publishedVersion: null,
    problem: null,
    runsLast30Days: 0,
    lastRunAt: null,
    updatedAt: now(),
    definition,
    published: null,
    versions: [],
    openRuns: 0,
    editableInGrowth: false,
    ...extra,
  }
}

function seed() {
  if (workflows.size > 0) return
  const high = BUILTIN_TEMPLATES[0]
  const cod = BUILTIN_TEMPLATES.find((t) => t.id === 'cancel-unconfirmed-cod')
  if (!high || !cod) return
  const live = detail('Tag high-value orders', structuredClone(high.definition), {
    status: 'on',
    hasDraft: false,
    templateId: high.id,
    publishedVersion: 2,
    published: structuredClone(high.definition),
    runsLast30Days: 48,
    lastRunAt: ago(35),
    versions: [
      { id: uuid(), number: 2, publishedAt: ago(60 * 24), publishedBy: 'Owner' },
      { id: uuid(), number: 1, publishedAt: ago(60 * 24 * 9), publishedBy: 'Owner' },
    ],
  })
  const draft = detail('Cancel unconfirmed COD', structuredClone(cod.definition), {
    templateId: cod.id,
  })
  workflows.set(live.id, live)
  workflows.set(draft.id, draft)
  const nodes = walkNodes(live.definition)
  const step = (
    nodeId: string,
    kind: StepRunView['kind'],
    status: StepRunView['status'],
    i: number,
  ) => ({
    id: uuid(),
    nodeId,
    kind,
    actionId:
      kind === 'action'
        ? ((live.definition.nodes[nodeId] as { action?: string }).action ?? null)
        : null,
    status,
    attempt: 1,
    input:
      kind === 'action'
        ? (live.definition.nodes[nodeId] as { config: Record<string, unknown> }).config
        : null,
    output: status === 'succeeded' ? { changed: true } : null,
    summary: null,
    error: status === 'failed' ? 'Email provider timed out' : null,
    startedAt: ago(35 - i),
    finishedAt: ago(35 - i),
    approval: null,
  })
  const make = (status: RunDetail['status'], label: string, failAt: number): RunDetail => {
    const path = nodes.map((n) => n.id)
    return {
      id: uuid(),
      workflowId: live.id,
      workflowName: live.name,
      versionNumber: 2,
      status,
      triggerType: live.triggerType,
      subject: { type: 'order', id: uuid(), label },
      isTest: false,
      manual: false,
      stopReason: null,
      error: status === 'failed' ? 'Email provider timed out' : null,
      startedAt: ago(35),
      finishedAt: ago(34),
      nextAt: null,
      definition: live.definition,
      steps: nodes.map((n, i) =>
        step(
          n.id,
          n.kind,
          n.kind === 'condition' ? 'then' : i === failAt ? 'failed' : 'succeeded',
          i,
        ),
      ),
      path,
      canRetry: status === 'failed',
      canCancel: false,
    }
  }
  runs.push(make('completed', '#1042', -1), make('failed', '#1041', 2))
}

const summary = (w: WorkflowDetail): WorkflowSummary => {
  const {
    definition: _d,
    published: _p,
    versions: _v,
    openRuns: _o,
    editableInGrowth: _e,
    ...s
  } = w
  return s
}

function must(id: string): WorkflowDetail {
  seed()
  const w = workflows.get(id)
  if (!w) throw new Error('Workflow not found')
  return w
}

export const automationDevMock = {
  catalogue: (): CatalogueView => ({
    triggers: BUILTIN_TRIGGERS.map(({ configSchema: _c, ...t }) => t),
    actions: BUILTIN_ACTIONS.map(({ configSchema: _c, ...a }) => a),
    fields: [...CONDITION_FIELDS],
    pluginFields: {},
  }),
  templates: (): TemplateView[] =>
    BUILTIN_TEMPLATES.map((t) => ({
      id: t.id,
      nameKey: t.nameKey,
      descriptionKey: t.descriptionKey,
      name: null,
      description: null,
      category: t.category,
      triggerType: t.definition.trigger.type,
      pluginId: null,
      available: true,
    })),
  usage: (): AutomationUsage => {
    seed()
    return {
      month: now().slice(0, 7),
      runs: 1640,
      runsLimit: 2000,
      activeWorkflows: [...workflows.values()].filter((w) => w.status === 'on').length,
      activeLimit: 5,
      connectors: false,
      appInstalled: true,
    }
  },
  list: (origin?: 'automations' | 'growth'): WorkflowSummary[] => {
    seed()
    return [...workflows.values()].filter((w) => !origin || w.origin === origin).map(summary)
  },
  get: (id: string): WorkflowDetail | null => {
    seed()
    return workflows.get(id) ?? null
  },
  create: (input: { templateId?: string; triggerType?: string; name?: string | undefined }) => {
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === input.templateId)
    const def = tpl
      ? structuredClone(tpl.definition)
      : emptyDefinition(input.triggerType ?? 'order.paid')
    const w = detail(input.name || (tpl ? tpl.id.replace(/-/g, ' ') : 'Untitled workflow'), def, {
      templateId: tpl?.id ?? null,
    })
    workflows.set(w.id, w)
    return w
  },
  update: (input: {
    id: string
    name?: string | undefined
    draft?: WorkflowDefinition | undefined
  }) => {
    const w = must(input.id)
    const next = {
      ...w,
      ...(input.name ? { name: input.name } : {}),
      ...(input.draft
        ? { definition: input.draft, triggerType: input.draft.trigger.type, hasDraft: true }
        : {}),
      updatedAt: now(),
    }
    workflows.set(w.id, next)
    return next
  },
  publish: (input: { id: string; turnOn: boolean }): PublishResult => {
    const w = must(input.id)
    const version = (w.publishedVersion ?? 0) + 1
    workflows.set(w.id, {
      ...w,
      hasDraft: false,
      published: w.definition,
      publishedVersion: version,
      status: input.turnOn ? 'on' : w.status,
      versions: [
        { id: uuid(), number: version, publishedAt: now(), publishedBy: 'You' },
        ...w.versions,
      ],
    })
    return { ok: true, version, status: input.turnOn ? 'on' : w.status }
  },
  setStatus: (input: { id: string; status: 'on' | 'off' }) => {
    const w = { ...must(input.id), status: input.status }
    workflows.set(w.id, w)
    return w
  },
  restoreVersion: (input: { id: string }) => {
    const w = must(input.id)
    return { ...w, definition: w.published ?? w.definition, hasDraft: true }
  },
  duplicate: (input: { id: string }) => {
    const w = must(input.id)
    const copy = detail(`${w.name} (copy)`, structuredClone(w.definition))
    workflows.set(copy.id, copy)
    return copy
  },
  delete: (input: { id: string }) => {
    workflows.delete(input.id)
    return { ok: true as const }
  },
  testRun: (input: { id: string; definition?: WorkflowDefinition | undefined }): TestRunResult => {
    const def = input.definition ?? must(input.id).definition
    const steps = walkNodes(def).map((n) => ({
      nodeId: n.id,
      kind: n.kind,
      actionId: n.kind === 'action' ? n.action : null,
      status:
        n.kind === 'condition'
          ? ('then' as const)
          : n.kind === 'wait'
            ? ('would_wait' as const)
            : ('would_run' as const),
      summary:
        n.kind === 'action'
          ? `Would run ${n.action}`
          : n.kind === 'wait'
            ? `Would wait ${n.minutes} minutes`
            : 'Rules hold',
      warnings: [],
      output: null,
    }))
    return { subject: null, steps, path: steps.map((s) => s.nodeId), blocked: null }
  },
  runsList: (input: { workflowId?: string | undefined; status?: string | undefined }): RunPage => {
    seed()
    const rows = runs.filter(
      (r) =>
        (!input.workflowId || r.workflowId === input.workflowId) &&
        (!input.status || r.status === input.status),
    )
    return {
      runs: rows.map(
        ({ definition: _d, steps: _s, path: _p, canRetry: _r, canCancel: _c, ...r }) => r,
      ),
      nextCursor: null,
    }
  },
  runsGet: (id: string): RunDetail | null => {
    seed()
    return runs.find((r) => r.id === id) ?? null
  },
  approvals: (): ApprovalItem[] => [],
}
