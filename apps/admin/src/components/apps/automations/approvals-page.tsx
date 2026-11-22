'use client'

import type { ApprovalItem } from '@commerce/core/automations'
import { ShieldCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import SectionHead from '@/components/layout/section-head'
import { appsContent } from '@/data/apps'
import { automationPiecesContent, automationsContent } from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy, useLocale } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { errorText } from '@/lib/api-errors'
import { automationApi } from '@/lib/automation-api'
import { actionLabel } from '@/lib/automation-labels'
import { automationRoutes, recordHref } from '@/lib/automation-routes'
import { isForbidden } from '@/lib/forbidden'

/** Needs approval: steps set to "Ask before running" waiting for a member to approve or decline. */
export default function ApprovalsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const all = useCopy(automationsContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const catalogue = useAutomationCatalogue()
  const [items, setItems] = useState<ApprovalItem[] | null>(null)
  const [failed, setFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)
  const [deciding, setDeciding] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    let live = true
    setFailed(false)
    automationApi.approvals
      .list()
      .then((rows) => live && setItems(rows))
      .catch((err: unknown) => live && setFailed(isForbidden(err) ? 'no-access' : 'error'))
    return () => {
      live = false
    }
  }, [attempt])

  // Event handlers
  const handleDecide = async (item: ApprovalItem, approve: boolean) => {
    setDeciding(item.stepRunId)
    try {
      await automationApi.approvals.decide(item.stepRunId, approve)
      setItems((rows) => (rows ?? []).filter((r) => r.stepRunId !== item.stepRunId))
      toast.success(approve ? copy.approved : copy.declined)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setDeciding(null)
    }
  }

  // Early returns
  if (failed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.approvals}
        failed={failed}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    )
  }

  // Render logic
  const copy = all.approvals

  return (
    <div className="flex flex-col gap-4">
      <SectionHead title={copy.title} intro={copy.intro} />
      {items === null ? (
        <Skeleton className="h-32 w-full" />
      ) : items.length === 0 ? (
        <EmptyState variant="page" icon={ShieldCheck} heading={copy.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const action = catalogue?.actions.find((a) => a.id === item.actionId) ?? null
            const href = recordHref(item.subject.type, item.subject.id)
            return (
              <li key={item.stepRunId}>
                <Card gap={3} inset={4}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-body-strong text-ink-strong">
                        {actionLabel(pieces, locale, action, item.actionId)}
                        {' · '}
                        {href ? (
                          <Link href={href} className="underline underline-offset-4">
                            {item.subject.label}
                          </Link>
                        ) : (
                          item.subject.label
                        )}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        <Link
                          href={automationRoutes.workflow(item.workflowId)}
                          className="underline underline-offset-4"
                        >
                          {item.workflowName}
                        </Link>
                        {' · '}
                        {copy.requested} <RelativeTime value={item.requestedAt} />
                        {item.expiresAt ? (
                          <>
                            {' · '}
                            {copy.expires} <RelativeTime value={item.expiresAt} />
                          </>
                        ) : null}
                      </p>
                      {item.summary ? (
                        <p className="text-body text-foreground">{item.summary}</p>
                      ) : null}
                      {item.canDecide ? null : (
                        <p className="text-caption text-muted-foreground">{copy.noPermission}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        nativeButton={false}
                        render={<Link href={automationRoutes.run(item.runId)} />}
                      >
                        {copy.openRun}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={!item.canDecide || deciding !== null}
                        onClick={() => void handleDecide(item, false)}
                      >
                        {copy.decline}
                      </Button>
                      <Button
                        disabled={!item.canDecide || deciding !== null}
                        onClick={() => void handleDecide(item, true)}
                      >
                        {copy.approve}
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
