'use client'

import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import TableEmptyRow from '@/components/table/table-empty-row'
import { appsContent } from '@/data/apps'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import PeriodTabs, { type Period } from './period-tabs'
import RiskChip from './risk-chip'

const LEVELS = ['high', 'medium', 'low'] as const

/** The COD & RTO app's home: RTO rates, COD answers, open orders by risk, worst PIN codes. */
export default function OverviewPage() {
  // Hooks
  const copy = useCopy(codRtoContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const [period, setPeriod] = useState<Period>('30')
  const { data, failed, retry, setData } = useLoad(
    () => api.codRto.overview({ days: Number(period) }),
    [period],
  )
  const [scoring, setScoring] = useState(false)

  // Helpers
  const pct = (n: number) => `${f.number(n)}%`

  // Event handlers
  const handleScoreOpen = async () => {
    setScoring(true)
    try {
      const r = await api.codRto.scoreOpen()
      toast.success(copy.overview.scored(r.scored, r.left))
      setData(await api.codRto.overview({ days: Number(period) }))
    } catch (err) {
      toast.error(errorText(err, String(err)))
    } finally {
      setScoring(false)
    }
  }

  // Render logic
  const o = copy.overview

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={o.title}
        summary={o.subtitle}
        actions={<PeriodTabs value={period} onChange={setPeriod} />}
      />
      {failed ? (
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.overview}
          failed={failed}
          onRetry={retry}
        />
      ) : data ? (
        <>
          <StatStrip
            tiles={[
              {
                id: 'rto',
                label: o.rtoRate,
                value: pct(data.rto.ratePercent),
                note: o.rtoRateNote(data.rto.count, data.rto.shipments),
              },
              {
                id: 'cod',
                label: o.codRate,
                value: pct(data.cod.codRate),
                note: o.rateNote(data.cod.codRto, data.cod.codFinished),
              },
              {
                id: 'prepaid',
                label: o.prepaidRate,
                value: pct(data.cod.prepaidRate),
                note: o.rateNote(data.cod.prepaidRto, data.cod.prepaidFinished),
              },
              {
                id: 'goods',
                label: o.rtoCost,
                value: f.moneyCompact(data.rto.goodsPaise),
                note: o.rtoCostNote,
              },
            ]}
          />
          <StatStrip
            tiles={[
              {
                id: 'confirmed',
                label: o.confirmedRate,
                value: pct(data.confirmation.confirmedRate),
                note: o.confirmedNote(data.confirmation.confirmed, data.confirmation.asked),
              },
              {
                id: 'waiting',
                label: o.waiting,
                value: f.number(data.confirmation.pending + data.confirmation.unconfirmed),
                note: o.waitingNote(data.confirmation.unconfirmed),
              },
              {
                id: 'cancelled',
                label: o.cancelledByShopper,
                value: f.number(data.confirmation.cancelled),
                note: o.cancelledNote,
              },
            ]}
          />
          <DataCard
            title={o.riskTitle}
            subtitle={o.riskHelp}
            bodyClassName="flex flex-col gap-3"
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={routes.apps.page('cod-rto', 'orders')} />}
              >
                {o.viewRisky}
              </Button>
            }
          >
            <div className="flex flex-wrap gap-3">
              {LEVELS.map((l) => (
                <span key={l} className="flex items-center gap-2">
                  <RiskChip level={l} label={copy.levels[l] ?? l} />
                  <span className="text-body font-semibold tabular-nums">
                    {f.number(data.openByLevel[l])}
                  </span>
                </span>
              ))}
            </div>
            {data.unscored > 0 ? (
              <Alert
                action={
                  <Button
                    loading={scoring}
                    size="sm"
                    variant="outline"
                    disabled={scoring}
                    onClick={handleScoreOpen}
                  >
                    {o.scoreOpen}
                  </Button>
                }
              >
                <AlertDescription>{o.unscored(data.unscored)}</AlertDescription>
              </Alert>
            ) : null}
          </DataCard>
          <DataCard title={o.pincodesTitle} flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>{o.columns.pincode}</TableHead>
                  <TableHead className={HEAD}>{o.columns.city}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{o.columns.shipments}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{o.columns.rto}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{o.columns.rate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pincodes.length === 0 ? (
                  <TableEmptyRow colSpan={5} message={o.pincodesEmpty} />
                ) : null}
                {data.pincodes.map((p) => (
                  <TableRow key={p.pincode}>
                    <TableCell className={`${CELL} font-medium tabular-nums`}>
                      {p.pincode}
                    </TableCell>
                    <TableCell className={CELL}>{p.city}</TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.number(p.shipments)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.number(p.rto)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {pct(p.ratePercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataCard>
        </>
      ) : (
        // Two stat strips (4 and 3 figures), the risk card and the PIN code table.
        <>
          <StatStrip tiles={[]} loading placeholders={4} />
          <StatStrip tiles={[]} loading placeholders={3} />
          <DataCardSkeleton fields={0} lines={2} />
          <DataCardSkeleton fields={0} lines={4} />
        </>
      )}
    </div>
  )
}
