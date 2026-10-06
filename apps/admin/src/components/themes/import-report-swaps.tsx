import type { SwapKey } from '@commerce/core/theme-import'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
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
    <Card gap="none" inset="none">
      <CardHeader className="border-b border-border px-5 py-4">
        <CardTitle>{copy.swapsHeading}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-2/5 pl-5">{copy.swapColumns.shopify}</TableHead>
              <TableHead className="pr-5">{copy.swapColumns.ours}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {swaps.map((key) => (
              <TableRow key={key}>
                <TableCell className="pl-5 align-top font-medium whitespace-normal">
                  {copy.swaps[key].shopify}
                </TableCell>
                <TableCell className="pr-5 align-top whitespace-normal text-muted-foreground">
                  {copy.swaps[key].ours}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
