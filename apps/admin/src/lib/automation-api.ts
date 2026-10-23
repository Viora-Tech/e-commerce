/**
 * The Automations app's calls to `api.automations.*`. Outside production a procedure that still
 * answers NOT_IMPLEMENTED (the engine lands in parallel) falls back to `automation-dev-mock`, so
 * the pages render; `usedDevMock()` / `subscribeDevMock` let a page say it is showing sample data. In production
 * every error reaches the caller unchanged.
 */
import type { RunStatus, WorkflowDefinition } from '@commerce/core/automations'
import { api } from '@/lib/api-client'
import { automationDevMock as mock } from '@/lib/automation-dev-mock'

let mocked = false
const listeners = new Set<() => void>()

const isNotImplemented = (err: unknown) =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'NOT_IMPLEMENTED'

async function call<T>(real: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await real()
  } catch (err) {
    if (process.env.NODE_ENV === 'production' || !isNotImplemented(err)) throw err
    if (!mocked) {
      mocked = true
      for (const l of listeners) l()
    }
    return fallback()
  }
}

/** True once any call was answered by the dev mock (a `useSyncExternalStore` snapshot). */
export const usedDevMock = () => mocked

export function subscribeDevMock(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const a = () => api.automations

export const automationApi = {
  catalogue: () => call(() => a().catalogue(), mock.catalogue),
  templates: () => call(() => a().templates(), mock.templates),
  usage: () => call(() => a().usage(), mock.usage),
  list: (origin?: 'automations' | 'growth') =>
    call(
      () => a().list(origin ? { origin } : {}),
      () => mock.list(origin),
    ),
  get: (id: string) =>
    call(
      () => a().get({ id }),
      () => mock.get(id),
    ),
  create: (input: { templateId: string; name?: string } | { triggerType: string; name?: string }) =>
    call(
      () => a().create(input),
      () => mock.create(input),
    ),
  update: (input: {
    id: string
    name?: string
    description?: string
    draft?: WorkflowDefinition
  }) =>
    call(
      () => a().update(input),
      () => mock.update(input),
    ),
  publish: (input: { id: string; confirmName?: string; turnOn: boolean }) =>
    call(
      () => a().publish(input),
      () => mock.publish(input),
    ),
  setStatus: (input: { id: string; status: 'on' | 'off'; waitingRuns: 'cancel' | 'finish' }) =>
    call(
      () => a().setStatus(input),
      () => mock.setStatus(input),
    ),
  restoreVersion: (input: { id: string; versionId: string }) =>
    call(
      () => a().restoreVersion(input),
      () => mock.restoreVersion(input),
    ),
  duplicate: (id: string) =>
    call(
      () => a().duplicate({ id }),
      () => mock.duplicate({ id }),
    ),
  delete: (id: string) =>
    call(
      () => a().delete({ id }),
      () => mock.delete({ id }),
    ),
  testRun: (input: {
    id: string
    definition?: WorkflowDefinition
    subject: { type: string; id: string } | null
  }) =>
    call(
      () => a().testRun(input),
      () => mock.testRun(input),
    ),
  runs: {
    list: (input: {
      workflowId?: string
      status?: RunStatus
      record?: { type: string; id: string }
      cursor?: string
    }) =>
      call(
        () => a().runs.list({ limit: 50, ...input }),
        () => mock.runsList(input),
      ),
    get: (id: string) =>
      call(
        () => a().runs.get({ id }),
        () => mock.runsGet(id),
      ),
    retry: (id: string) => a().runs.retry({ id }),
    cancel: (id: string) => a().runs.cancel({ id }),
  },
  approvals: {
    list: () => call(() => a().approvals.list(), mock.approvals),
    decide: (stepRunId: string, approve: boolean) => a().approvals.decide({ stepRunId, approve }),
  },
}
