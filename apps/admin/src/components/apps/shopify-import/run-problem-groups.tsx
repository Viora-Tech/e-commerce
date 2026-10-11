'use client'

import type { ImportResource, IssueCause, IssueGroup } from '@commerce/plugin-shopify-import/client'
import { ChevronDown, CircleAlert, InfoIcon, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RunProblemGroupsProps = {
  runId: string
  /** Changes whenever the run moves on, so the groups refetch. */
  version: string
}

const isResource = (r: string, labels: Record<string, string>): r is ImportResource => r in labels

type ProblemsCopy = (typeof shopifyImportContent)['run']['problems']

/** How serious a cause is: store-wide breakage is red, lost records amber, notes grey. */
const SEVERITY = {
  storage: { icon: CircleAlert, tone: 'text-danger' },
  scope: { icon: CircleAlert, tone: 'text-danger' },
  order_number: { icon: TriangleAlert, tone: 'text-warning' },
  image: { icon: TriangleAlert, tone: 'text-warning' },
  file: { icon: TriangleAlert, tone: 'text-warning' },
  record: { icon: TriangleAlert, tone: 'text-warning' },
  note: { icon: InfoIcon, tone: 'text-muted-foreground' },
} as const satisfies Record<IssueCause, { icon: unknown; tone: string }>

/** Same unit as the card's "N records to retry": records, with the images or files they carry. */
function retryText(p: ProblemsCopy, g: IssueGroup): string {
  if (g.retryableProblems > g.retryable && g.cause === 'image') {
    return p.retryableImages(g.retryableProblems, g.retryable)
  }
  if (g.retryableProblems > g.retryable && g.cause === 'file') {
    return p.retryableFiles(g.retryableProblems, g.retryable)
  }
  return p.retryable(g.retryable)
}

/** A run's problems as collapsible rows, one per cause and type, each with its example and fix. */
export default function RunProblemGroups({ runId, version }: RunProblemGroupsProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const labels = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()
  const [groups, setGroups] = useState<IssueGroup[] | null>(null)

  useEffect(() => {
    if (!version) return
    let live = true
    api.shopifyImport
      .issueGroups({ runId })
      .then((next) => {
        if (live) setGroups(next)
      })
      .catch(() => {
        if (live) setGroups([])
      })
    return () => {
      live = false
    }
  }, [runId, version])

  // Early returns
  if (groups === null) return <Skeleton className="h-16 w-full" />

  // Render logic
  const p = copy.problems

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((g, i) => {
        const { icon: Severity, tone } = SEVERITY[g.cause]
        const types = g.resources.map((r) => (isResource(r, labels) ? labels[r] : r)).join(', ')
        return (
          <li key={`${g.cause}-${g.resources.join('-')}`} className="rounded-xl bg-card">
            <Collapsible defaultOpen={i === 0} className="group/problem">
              <CollapsibleTrigger className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring">
                <Severity className={`mt-0.5 size-4 shrink-0 ${tone}`} aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-ink-strong">{p.cause[g.cause](g.count)}</span>
                  <span className="text-caption text-muted-foreground">{types}</span>
                </span>
                <span className="rounded-full bg-chip-neutral px-2 py-0.5 text-caption font-medium text-chip-neutral-text tabular-nums">
                  {fmt.number(g.count)}
                </span>
                <ChevronDown
                  className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-data-[open]/problem:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0 motion-reduce:transition-none">
                <div className="flex flex-col gap-3 border-t border-hairline px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="line-clamp-3 text-caption break-words text-muted-foreground">
                      {p.example} {g.sample}
                    </span>
                    {g.retryable > 0 && g.cause !== 'storage' ? (
                      <span className="text-caption text-muted-foreground">{retryText(p, g)}</span>
                    ) : null}
                  </div>
                  {g.fixHref && (g.cause === 'storage' || g.cause === 'scope') ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 self-start"
                      nativeButton={false}
                      render={<Link href={g.fixHref} />}
                    >
                      {p.fix[g.cause]}
                    </Button>
                  ) : null}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </li>
        )
      })}
    </ul>
  )
}
