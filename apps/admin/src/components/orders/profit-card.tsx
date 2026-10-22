'use client'

import type { OrderProfit } from '@commerce/core/profit'
import { formatPercent, parseRupees } from '@commerce/money'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
import { profitCardContent } from '@/data/order-cards'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type ProfitCardProps = {
  orderId: string
  /** The order's latest consignment, when there is one: its courier charge can be typed here. */
  shipment: { id: string; courierChargePaise: number | null } | null
}

type NoteKey = keyof OrderProfit['flags']

const NOTE_ORDER: NoteKey[] = [
  'costMissing',
  'costEstimated',
  'courierMissing',
  'feeMissing',
  'feeFromRate',
]

/** What the order earned after goods, courier, payment fees and RTO, with why it may be off. */
export default function ProfitCard({ orderId, shipment }: ProfitCardProps) {
  // Hooks
  const copy = useCopy(profitCardContent)
  const fmt = useFormat()
  const [profit, setProfit] = useState<OrderProfit | null>(null)
  const [charge, setCharge] = useState(
    shipment?.courierChargePaise != null ? String(shipment.courierChargePaise / 100) : '',
  )
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey re-runs the fetch after a courier charge is saved.
    if (reloadKey < 0) return
    let live = true
    api.orders
      .profit({ orderId })
      .then((p) => {
        if (live) setProfit(p)
      })
      // Staff without analytics access see no profit card.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [orderId, reloadKey])

  // Event handlers
  const handleSaveCharge = async () => {
    if (!shipment) return
    const paise = charge.trim() === '' ? null : parseRupees(charge)
    if (charge.trim() !== '' && paise === null) {
      toast.error(copy.courierInvalid)
      return
    }
    setSaving(true)
    try {
      await api.orders.setCourierCharge({ shipmentId: shipment.id, chargePaise: paise })
      toast.success(copy.courierSaved)
      setReloadKey((k) => k + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (!profit) return null

  // Render logic
  // [label, paise, a cost taken off (shown with a minus), shown at all]
  const rows: [string, number, boolean, boolean][] = [
    [copy.netSales, profit.netSalesPaise, false, true],
    [copy.goods, profit.goodsPaise, true, true],
    [copy.courier, profit.courierPaise, true, true],
    [copy.fees, profit.feesPaise, true, true],
    [copy.rto, profit.rtoPaise, true, profit.rtoPaise > 0],
  ]
  // Whether the payment fees are the gateway's own figure or estimated from the store's rates.
  const feeSource = profit.feeSource
  const notes = NOTE_ORDER.filter((k) => profit.flags[k])
  const loss = profit.profitPaise < 0
  const lines: TotalsLine[] = [
    ...rows
      .filter(([, , , show]) => show)
      .map(([label, paise, cost]) => ({
        label,
        value: cost && paise > 0 ? `−${fmt.money(paise)}` : fmt.money(paise),
        detail:
          label === copy.fees && feeSource ? (
            <span title={copy.feeSourceHelp[feeSource]}>· {copy.feeSource[feeSource]}</span>
          ) : undefined,
      })),
    {
      label: copy.profit,
      value: loss ? `−${fmt.money(-profit.profitPaise)}` : fmt.money(profit.profitPaise),
      strong: true,
      negative: loss,
    },
  ]

  return (
    <DataCard title={copy.title}>
      <TotalsList lines={lines} />
      {profit.marginBps !== null ? (
        <p className="mt-2 text-right text-caption text-muted-foreground">
          {copy.margin(
            formatPercent(profit.marginBps / 10_000, {
              locale: fmt.intl,
              maximumFractionDigits: 1,
            }),
          )}
        </p>
      ) : null}
      {notes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 text-caption text-muted-foreground">
          {notes.map((k) => (
            <li key={k}>{copy.notes[k]}</li>
          ))}
        </ul>
      ) : null}
      {profit.flags.feeMissing || profit.flags.feeFromRate ? (
        <Link
          href={routes.settings.costs()}
          className="mt-2 inline-block text-caption text-primary hover:underline"
        >
          {copy.setRates}
        </Link>
      ) : null}
      {shipment ? (
        <div className="mt-3 flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="profit-courier-charge" className="text-caption text-muted-foreground">
              {copy.courierLabel}
            </label>
            <Input
              id="profit-courier-charge"
              inputMode="decimal"
              value={charge}
              onChange={(e) => setCharge(e.target.value)}
              disabled={saving}
            />
          </div>
          <Button variant="outline" onClick={handleSaveCharge} disabled={saving}>
            <Save aria-hidden="true" />
            {copy.courierSave}
          </Button>
        </div>
      ) : null}
    </DataCard>
  )
}
