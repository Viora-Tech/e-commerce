'use client'

import { conversionPercent } from '@commerce/plugin-affiliates/settings'
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
import { toast } from 'sonner'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import TableEmptyRow from '@/components/table/table-empty-row'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Trend = Awaited<ReturnType<typeof api.affiliates.trend>>

/** Saves text as a file in the browser; nothing leaves except to the merchant's disk. */
function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Overview › Trends: sales by week or month, conversion, top products and the ledger CSV. */
export default function AffiliateTrendCard() {
  // Hooks
  const { overview, failed } = useCopy(affiliatesContent)
  const f = useFormat()
  const [by, setBy] = useState<'week' | 'month'>('week')
  const [data, setData] = useState<Trend | null>(null)

  useEffect(() => {
    let cancelled = false
    api.affiliates.trend({ by }).then((r) => {
      if (!cancelled) setData(r)
    })
    return () => {
      cancelled = true
    }
  }, [by])

  // Event handlers
  const handleCsv = async () => {
    try {
      const { csv } = await api.affiliates.ledgerCsv()
      saveFile('affiliate-commissions.csv', csv)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    }
  }

  // Early returns
  if (!data) return null

  // Render logic
  const t = overview.trend
  const max = Math.max(1, ...data.points.map((p) => p.salesPaise))
  const clicks = data.points.reduce((s, p) => s + p.clicks, 0)
  const orders = data.points.reduce((s, p) => s + p.orders, 0)
  const conversion = conversionPercent(orders, clicks)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 rounded-xl surface-card px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-ink-strong">{t.title}</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={by === 'week' ? 'secondary' : 'ghost'}
              onClick={() => setBy('week')}
            >
              {t.week}
            </Button>
            <Button
              size="sm"
              variant={by === 'month' ? 'secondary' : 'ghost'}
              onClick={() => setBy('month')}
            >
              {t.month}
            </Button>
            <Button size="sm" variant="outline" onClick={handleCsv}>
              {t.csv}
            </Button>
          </div>
        </div>
        {data.points.length === 0 ? (
          <p className="text-body text-muted-foreground">{t.empty}</p>
        ) : (
          <ol className="flex h-40 items-end gap-1.5" aria-label={t.title}>
            {data.points.map((p) => (
              <li key={p.period} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className="w-full rounded-t-sm bg-primary/80"
                  style={{ height: `${Math.max(2, (p.salesPaise / max) * 100)}%` }}
                  title={t.bar(f.money(p.salesPaise), p.orders, p.clicks)}
                />
                <span className="truncate text-[0.625rem] text-muted-foreground">
                  {f.pattern(
                    new Date(`${p.period}T00:00:00+05:30`),
                    by === 'week' ? { day: 'numeric', month: 'short' } : { month: 'short' },
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="text-caption text-muted-foreground">
          {conversion === null
            ? t.noClicks
            : t.conversion(conversion, f.number(clicks), f.number(orders))}
        </p>
      </div>
      <div className="overflow-hidden rounded-xl surface-card">
        <h2 className="px-6 pt-5 pb-3 text-body font-semibold text-ink-strong">
          {t.productsTitle}
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{t.columns.product}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{t.columns.units}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{t.columns.orders}</TableHead>
              <TableHead className={`${HEAD} text-right`}>{t.columns.commission}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.products.length === 0 ? (
              <TableEmptyRow colSpan={4} message={t.productsEmpty} />
            ) : null}
            {data.products.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className={`${CELL} font-medium`}>{p.title}</TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.number(p.units)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.number(p.orders)}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums`}>
                  {f.money(p.commissionPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
