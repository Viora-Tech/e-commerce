'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { shipmentsContent } from '@/data/shipments'
import type { api } from '@/lib/api-client'

type CompareRow = Awaited<ReturnType<typeof api.shipments.compareRates>>[number]

type CourierCompareTableProps = {
  rows: CompareRow[]
  overrides: Record<string, string>
  onOverrideChange: (orderId: string, providerId: string) => void
}

const copy = shipmentsContent.book.compare
const STORE_DEFAULT = '__default'
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`

function transitLabel(min: number | null, max: number | null): string {
  if (min === null || max === null) return copy.noEta
  return copy.days(min, max)
}

function codLabel(available: boolean | null): string {
  if (available === null) return copy.codUnknown
  return available ? copy.codYes : copy.codNo
}

/** The picked (or default-rule-resolved) row for an order: the recommended option unless the
 *  merchant chose a specific courier for this row. */
function pickedOption(row: CompareRow, overrideId: string | undefined) {
  if (overrideId) return row.options.find((o) => o.providerId === overrideId) ?? null
  return row.options.find((o) => o.badges.includes('recommended')) ?? row.options[0] ?? null
}

/** Preview table for the bulk-book panel: every connected courier's price and ETA for each
 *  order's own address, with Cheapest / Fastest / Recommended badges and a per-row override. */
export default function CourierCompareTable({
  rows,
  overrides,
  onOverrideChange,
}: CourierCompareTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{copy.columns.order}</TableHead>
          <TableHead>{copy.columns.courier}</TableHead>
          <TableHead>{copy.columns.price}</TableHead>
          <TableHead>{copy.columns.eta}</TableHead>
          <TableHead>{copy.columns.cod}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const overrideId = overrides[row.orderId]
          const picked = pickedOption(row, overrideId)
          return (
            <TableRow key={row.orderId}>
              <TableCell className="font-medium">#{row.orderNumber}</TableCell>
              <TableCell>
                <Select
                  value={overrideId ?? STORE_DEFAULT}
                  onValueChange={(v) =>
                    onOverrideChange(row.orderId, String(v) === STORE_DEFAULT ? '' : String(v))
                  }
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STORE_DEFAULT}>{copy.useDefault}</SelectItem>
                    {row.options.map((o) => (
                      <SelectItem key={o.providerId} value={o.providerId}>
                        {o.providerLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {picked?.pricePaise !== null && picked?.pricePaise !== undefined
                  ? rupees(picked.pricePaise)
                  : copy.noPrice}
              </TableCell>
              <TableCell>
                {transitLabel(picked?.minTransitDays ?? null, picked?.maxTransitDays ?? null)}
              </TableCell>
              <TableCell className="flex items-center gap-1.5">
                {codLabel(picked?.codAvailable ?? null)}
                {picked?.badges.includes('cheapest') ? (
                  <Badge variant="outline">{copy.cheapest}</Badge>
                ) : null}
                {picked?.badges.includes('fastest') ? (
                  <Badge variant="outline">{copy.fastest}</Badge>
                ) : null}
                {!overrideId && picked?.badges.includes('recommended') ? (
                  <Badge variant="outline">{copy.recommended}</Badge>
                ) : null}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
