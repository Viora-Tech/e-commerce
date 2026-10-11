'use client'

import { ChevronLeftIcon, ChevronRight, CircleCheck, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import IconBadge from '@/components/layout/icon-badge'
import { shopifyImportContent } from '@/data/shopify-import'
import { shopifyImportRunContent } from '@/data/shopify-import-run'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RunProblemGroups from './run-problem-groups'
import type { IssueItem } from './types'

type RunIssuesCardProps = {
  runId: string
  count: number
  /** Records a retry would bring over (one record can have several problems). */
  retryable?: number | undefined
  /** Changes whenever the run moves on, so the list refetches. */
  version: string
}

const PER_PAGE = 50

/**
 * What could not be imported: a warning card with the problems grouped by cause and
 * type, each with one example and fix, and every record behind "Show every record".
 * No problems is one small green line.
 */
export default function RunIssuesCard({
  runId,
  count,
  retryable = 0,
  version,
}: RunIssuesCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const view = useCopy(shopifyImportRunContent)
  const resources = useCopy(shopifyImportContent.resources)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<IssueItem[]>([])
  const [all, setAll] = useState(false)

  useEffect(() => {
    // `version` changes as the run moves on; refetch then.
    if (count === 0 || !version || !all) return
    let live = true
    api.shopifyImport
      .issues({ runId, page, perPage: PER_PAGE })
      .then((r) => {
        if (live) setItems(r.items)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [runId, page, count, version, all])

  // Event handlers
  const handleToggle = () => setAll(!all)

  // Early returns
  if (count === 0) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-hairline bg-card px-4 py-3 text-body font-medium text-success">
        <CircleCheck weight="fill" className="size-4" aria-hidden />
        {view.problems.none}
      </p>
    )
  }

  // Render logic
  const pages = Math.ceil(count / PER_PAGE)

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning-soft/40 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <IconBadge icon={TriangleAlert} tone="warning" />
          <div className="flex flex-col gap-1">
            <h2 className="text-card-title text-ink-strong">{copy.issuesHeading(count)}</h2>
            <p className="text-body text-muted-foreground">{view.problems.summary(count)}</p>
            {retryable > 0 && retryable !== count ? (
              <p className="text-caption text-muted-foreground">{copy.problems.unit(retryable)}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 self-start"
          onClick={handleToggle}
        >
          {all ? view.problems.hideRecords : view.problems.showRecords}
        </Button>
      </div>
      {all ? (
        <div className="overflow-hidden rounded-xl bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.issueColumns.where}</TableHead>
                <TableHead>{copy.issueColumns.what}</TableHead>
                <TableHead>{copy.issueColumns.message}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {i.row
                      ? copy.line(i.row)
                      : (resources[i.resource as keyof typeof shopifyImportContent.resources] ??
                        i.resource)}
                  </TableCell>
                  <TableCell className="max-w-56 truncate font-medium">{i.ref ?? ''}</TableCell>
                  <TableCell className="whitespace-normal">{i.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {pages > 1 ? (
            <div className="flex justify-end gap-2 p-4">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                aria-label={copy.previous}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage(page + 1)}
                aria-label={copy.next}
              >
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <RunProblemGroups runId={runId} version={version} />
      )}
    </section>
  )
}
