'use client'

import type { AutomationUsage, WorkflowDetail } from '@commerce/core/automations'
import { permissions } from '@commerce/core/permissions'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import { appsContent } from '@/data/apps'
import { useAutomationCatalogueLoad } from '@/hooks/use-automation-catalogue'
import { useCopy } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { usePermissions } from '@/hooks/use-permissions'
import { automationApi } from '@/lib/automation-api'
import { isForbidden } from '@/lib/forbidden'
import WorkflowEditor from './editor/workflow-editor'

/** `/apps/automations/workflows/<id>`: loads the workflow, the catalogue and the plan, then the editor. */
export default function WorkflowPage({ params }: AppPageProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const catalogueLoad = useAutomationCatalogueLoad()
  const { member, loading, hasPermission } = usePermissions()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  /** The workflow read failed: Try again (or no-access) instead of a dead end. */
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)
  const [usage, setUsage] = useState<AutomationUsage | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    const id = params.id
    if (!id) return
    let live = true
    setFailed(false)
    automationApi
      .get(id)
      .then((w) => live && setWorkflow(w))
      .catch((err: unknown) => live && setFailed(isForbidden(err) ? 'no-access' : 'error'))
    automationApi
      .usage()
      .then((u) => live && setUsage(u))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [params.id, attempt])

  // Event handlers
  const handleRetry = () => {
    if (failed) setAttempt((n) => n + 1)
    if (catalogueLoad.failed) catalogueLoad.retry()
  }

  // Early returns
  if (failed || catalogueLoad.failed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.workflow}
        failed={failed || catalogueLoad.failed || undefined}
        onRetry={handleRetry}
      />
    )
  }
  const catalogue = catalogueLoad.data
  if (!workflow || !catalogue || loading) return <Skeleton className="h-[36rem] w-full" />

  // Render logic
  // Growth workflows also need marketing.write to edit here (design §8.7).
  const canEdit =
    hasPermission(permissions.AUTOMATIONS_WRITE) &&
    (workflow.origin !== 'growth' || hasPermission(permissions.MARKETING_WRITE))
  const plan = usage ? (usage.connectors ? 'pro' : 'starter') : null

  return (
    <div className="flex flex-col gap-3">
      <WorkflowEditor
        key={workflow.id}
        workflow={workflow}
        catalogue={catalogue}
        plan={plan}
        canEdit={canEdit}
        canPublish={hasPermission(permissions.AUTOMATIONS_PUBLISH)}
        isOwner={member?.isOwner ?? false}
      />
    </div>
  )
}
