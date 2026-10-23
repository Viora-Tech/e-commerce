/**
 * The Automations app's calls to `api.automations.*`, in one place so pages share the shapes
 * (the run list's page size, the optional origin filter).
 */
import type { RunStatus, WorkflowDefinition } from '@commerce/core/automations'
import { api } from '@/lib/api-client'

const a = () => api.automations

export const automationApi = {
  catalogue: () => a().catalogue(),
  templates: () => a().templates(),
  usage: () => a().usage(),
  list: (origin?: 'automations' | 'growth') => a().list(origin ? { origin } : {}),
  get: (id: string) => a().get({ id }),
  create: (input: { templateId: string; name?: string } | { triggerType: string; name?: string }) =>
    a().create(input),
  update: (input: {
    id: string
    name?: string
    description?: string
    draft?: WorkflowDefinition
  }) => a().update(input),
  publish: (input: { id: string; confirmName?: string; turnOn: boolean }) => a().publish(input),
  setStatus: (input: { id: string; status: 'on' | 'off'; waitingRuns: 'cancel' | 'finish' }) =>
    a().setStatus(input),
  restoreVersion: (input: { id: string; versionId: string }) => a().restoreVersion(input),
  duplicate: (id: string) => a().duplicate({ id }),
  delete: (id: string) => a().delete({ id }),
  testRun: (input: {
    id: string
    definition?: WorkflowDefinition
    subject: { type: string; id: string } | null
  }) => a().testRun(input),
  runs: {
    list: (input: {
      workflowId?: string
      status?: RunStatus
      record?: { type: string; id: string }
      cursor?: string
    }) => a().runs.list({ limit: 50, ...input }),
    get: (id: string) => a().runs.get({ id }),
    retry: (id: string) => a().runs.retry({ id }),
    cancel: (id: string) => a().runs.cancel({ id }),
  },
  approvals: {
    list: () => a().approvals.list(),
    decide: (stepRunId: string, approve: boolean) => a().approvals.decide({ stepRunId, approve }),
  },
}
