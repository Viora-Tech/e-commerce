import type { SwapKey } from '@commerce/core/theme-import'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import ScrollSection from '@/components/layout/scroll-section'
import SimpleTable from '@/components/table/simple-table'
import type { themeImportContent } from '@/data/theme-import'

type ImportReportSwapsProps = {
  copy: (typeof themeImportContent)['report']
  swaps: SwapKey[]
}

/** The swap table for this theme: each Shopify feature it used, and what runs here instead. */
export default function ImportReportSwaps({ copy, swaps }: ImportReportSwapsProps) {
  // Early returns
  if (swaps.length === 0) return null

  // Render logic
  return (
    <DataCard title={copy.swapsHeading} flush>
      <ScrollSection id="theme-report-swaps" label={copy.swapsHeading} count={swaps.length}>
        <SimpleTable
          columns={[
            { key: 'shopify', label: copy.swapColumns.shopify, className: 'w-2/5' },
            { key: 'ours', label: copy.swapColumns.ours },
          ]}
        >
          {swaps.map((key) => (
            <TableRow key={key}>
              <TableCell className="align-top font-medium whitespace-normal">
                {copy.swaps[key].shopify}
              </TableCell>
              <TableCell className="align-top whitespace-normal text-muted-foreground">
                {copy.swaps[key].ours}
              </TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </ScrollSection>
    </DataCard>
  )
}
