'use client'

import type { SameBoxChoice } from '@commerce/core'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import { sharedParcelContent } from '@/data/shared-parcel'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type SameBoxFieldProps = {
  orderId: string
  /** The picked box's shipment id, or '' for the order's own parcel. */
  value: string
  onChange: (shipmentId: string) => void
}

const OWN = 'own'

/**
 * "Same box as #A" on Fulfil items: when another open order of this customer already has a live
 * parcel, the items can go in that box instead of their own. Shows nothing when there is none.
 */
export default function SameBoxField({ orderId, value, onChange }: SameBoxFieldProps) {
  // Hooks
  const copy = useCopy(sharedParcelContent)
  const [choices, setChoices] = useState<SameBoxChoice[]>([])
  useEffect(() => {
    let live = true
    api.orders
      .sameBoxChoices({ orderId })
      .then((c) => {
        if (live) setChoices(c)
      })
      // Without the list the card still packs into the order's own parcel.
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [orderId])

  // Early returns
  if (choices.length === 0) return null

  // Render logic
  const items = [
    { value: OWN, label: copy.ownParcel },
    ...choices.map((c) => ({
      value: c.shipmentId,
      label: copy.sameBox(c.orderNumber, c.courier, c.waybill),
    })),
  ]

  return (
    <Field>
      <FieldLabel htmlFor="fulfil-same-box">{copy.label}</FieldLabel>
      <Select
        items={items}
        value={value || OWN}
        onValueChange={(v) => onChange(!v || v === OWN ? '' : String(v))}
      >
        <SelectTrigger id="fulfil-same-box" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{copy.hint}</FieldDescription>
    </Field>
  )
}
