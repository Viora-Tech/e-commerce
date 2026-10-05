import { IMPORT_RESOURCES } from '@commerce/plugin-shopify-import/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import KitProgress from '@/components/kit/kit-progress'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { RunDetail } from './types'

type RunProgressCardProps = { run: RunDetail }

/** Counters per resource: a bar while it runs, then new, updated, skipped and failed. */
export default function RunProgressCard({ run }: RunProgressCardProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const resources = useCopy(shopifyImportContent.resources)
  const fmt = useFormat()

  // Render logic
  const rows = IMPORT_RESOURCES.filter((r) => run.resources.includes(r)).map((resource) => ({
    resource,
    p: run.progress[resource] ?? {
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
  }))
  const numeric = 'text-right tabular-nums'

  return (
    <DataCard title={copy.progressHeading} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.columns.what}</TableHead>
            <TableHead className="w-1/3">{copy.columns.progress}</TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {copy.columns.created}
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {copy.columns.updated}
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              {copy.columns.skipped}
            </TableHead>
            <TableHead className="text-right">{copy.columns.failed}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ resource, p }) => (
            <TableRow key={resource}>
              <TableCell className="font-medium">{resources[resource]}</TableCell>
              <TableCell>
                <span className="flex items-center gap-3">
                  <KitProgress
                    value={p.total ? p.processed / p.total : 0}
                    className="hidden max-w-40 min-w-16 sm:block"
                  />
                  <span className="text-caption text-muted-foreground tabular-nums">
                    {copy.counted(p.processed, p.total)}
                  </span>
                </span>
              </TableCell>
              <TableCell className={`hidden sm:table-cell ${numeric}`}>
                {fmt.number(p.created)}
              </TableCell>
              <TableCell className={`hidden sm:table-cell ${numeric}`}>
                {fmt.number(p.updated)}
              </TableCell>
              <TableCell className={`hidden sm:table-cell ${numeric}`}>
                {fmt.number(p.skipped)}
              </TableCell>
              <TableCell className={`${numeric} ${p.failed ? 'text-destructive' : ''}`}>
                {fmt.number(p.failed)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
