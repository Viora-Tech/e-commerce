'use client'

import type { AutomationUsage, WorkflowDetail } from '@commerce/core/automations'
import { permissions } from '@commerce/core/permissions'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import EmptyState from '@/components/layout/empty-state'
import { automationsContent } from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { automationApi } from '@/lib/automation-api'
import DevMockNotice from './dev-mock-notice'
import WorkflowEditor from './editor/workflow-editor'

/** `/apps/automations/workflows/<id>`: loads the workflow, the catalogue and the plan, then the editor. */
export default function WorkflowPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(automationsContent)
  const catalogue = useAutomationCatalogue()
  const { member, loading, hasPermission } = usePermissions()
  const [workflow, setWorkflow] = useState<WorkflowDetail | null | undefined>(undefined)
  const [usage, setUsage] = useState<AutomationUsage | null>(null)

  useEffect(() => {
    const id = params.id
    if (!id) return
    let live = true
    automationApi
      .get(id)
      .then((w) => live && setWorkflow(w))
      .catch(() => live && setWorkflow(null))
    automationApi
      .usage()
      .then((u) => live && setUsage(u))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [params.id])

  // Early returns
  if (workflow === null) return <EmptyState variant="page" tone="danger" body={copy.loadFailed} />
  if (workflow === undefined || !catalogue || loading)
    return <Skeleton className="h-[36rem] w-full" />

  // Render logic
  // Growth workflows also need marketing.write to edit here (design §8.7).
  const canEdit =
    hasPermission(permissions.AUTOMATIONS_WRITE) &&
    (workflow.origin !== 'growth' || hasPermission(permissions.MARKETING_WRITE))
  const plan = usage ? (usage.connectors ? 'pro' : 'starter') : null

  return (
    <div className="flex flex-col gap-3">
      <DevMockNotice />
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
