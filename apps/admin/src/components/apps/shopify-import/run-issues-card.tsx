'use client'

import { ChevronLeftIcon, ChevronRight } from '@commerce/ui/icons'
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
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { IssueItem } from './types'

type RunIssuesCardProps = {
  runId: string
  count: number
  /** Changes whenever the run moves on, so the list refetches. */
  version: string
}

const PER_PAGE = 50

/** Every row or record that could not be imported, with the reason. */
export default function RunIssuesCard({ runId, count, version }: RunIssuesCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const resources = useCopy(shopifyImportContent.resources)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<IssueItem[]>([])

  useEffect(() => {
    // `version` changes as the run moves on; refetch then.
    if (count === 0 || !version) return
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
  }, [runId, page, count, version])

  // Early returns
  if (count === 0) {
    return (
      <DataCard title={copy.issuesHeading(0)}>
        <p className="text-body text-muted-foreground">{copy.issuesNone}</p>
      </DataCard>
    )
  }

  // Render logic
  const pages = Math.ceil(count / PER_PAGE)

  return (
    <DataCard title={copy.issuesHeading(count)} flush>
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
    </DataCard>
  )
}
