'use client'

import { parseRupees } from '@commerce/money'
import { Save, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent } from '@/data/returns'
import { api } from '@/lib/api-client'
import { type ReturnDetail, toRupees } from './return-types'

type RtoCardProps = { detail: ReturnDetail; onChanged: () => void }

const copy = returnDetailContent.rto

/** The RTO task's banner: what happened, what to do, and the courier's charge for it. */
export default function RtoCard({ detail: r, onChanged }: RtoCardProps) {
  // Hooks
  const [cost, setCost] = useState(() =>
    r.courierCostPaise === null ? '' : toRupees(r.courierCostPaise),
  )
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      const paise = parseRupees(cost)
      await api.returns.setCourierCost({ id: r.id, paise })
      toast.success(copy.costSaved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <DataCard title={copy.banner}>
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-body text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {copy.bannerHint}
            {r.rtoShipment ? ` ${copy.shipment(r.rtoShipment.waybill)}.` : ''}
          </span>
        </p>
        <Field>
          <FieldLabel htmlFor="rto-cost">{copy.cost}</FieldLabel>
          <div className="flex max-w-xs gap-2">
            <Input
              id="rto-cost"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={handleSave} disabled={busy}>
              <Save aria-hidden="true" />
              {copy.costSave}
            </Button>
          </div>
          <FieldDescription>{copy.costHint}</FieldDescription>
        </Field>
      </div>
    </DataCard>
  )
}
