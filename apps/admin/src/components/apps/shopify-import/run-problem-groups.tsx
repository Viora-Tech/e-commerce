'use client'

import type { ImportResource, IssueGroup } from '@commerce/plugin-shopify-import/client'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RunProblemGroupsProps = {
  runId: string
  /** Changes whenever the run moves on, so the groups refetch. */
  version: string
}

const isResource = (r: string, labels: Record<string, string>): r is ImportResource => r in labels

type ProblemsCopy = (typeof shopifyImportContent)['run']['problems']

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

/** A run's problems as a few lines, one per cause and type, each with its fix. */
export default function RunProblemGroups({ runId, version }: RunProblemGroupsProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const labels = useCopy(shopifyImportContent.resources)
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
    <ul className="flex flex-col divide-y divide-border">
      {groups.map((g) => (
        <li
          key={`${g.cause}-${g.resources.join('-')}`}
          className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-medium text-ink-strong">
              {p.cause[g.cause](g.count)}
              <span className="font-normal text-muted-foreground">
                {' · '}
                {g.resources.map((r) => (isResource(r, labels) ? labels[r] : r)).join(', ')}
              </span>
            </span>
            <span className="line-clamp-2 text-caption break-words text-muted-foreground">
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
        </li>
      ))}
    </ul>
  )
}
