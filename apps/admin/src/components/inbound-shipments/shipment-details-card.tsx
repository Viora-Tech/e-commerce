'use client'

import type { InboundCarrier } from '@commerce/core/inventory'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import DateField from '@/components/fields/date-field'
import OptionSelect from '@/components/landed-cost/option-select'
import DataCard from '@/components/layout/data-card'
import {
  INBOUND_SHIPMENT_STATUSES,
  type InboundShipmentStatus,
  inboundShipmentFormContent,
  inboundShipmentsContent,
} from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'

export type ShipmentDraft = {
  /** `INBOUND_CARRIERS` id, or null when not set. */
  carrier: InboundCarrier | null
  trackingNumber: string
  trackingUrl: string
  /** yyyy-mm-dd or empty. */
  expectedAt: string
  reference: string
  billOfEntryNo: string
  /** yyyy-mm-dd or empty, for the date inputs. */
  billOfEntryDate: string
  port: string
  arrivedAt: string
  status: InboundShipmentStatus
  note: string
}

type ShipmentDetailsCardProps = {
  draft: ShipmentDraft
  onChange: (patch: Partial<ShipmentDraft>) => void
}

/** Reference, Bill of Entry, port, arrival and where the consignment is now. */
export default function ShipmentDetailsCard({ draft, onChange }: ShipmentDetailsCardProps) {
  // Hooks
  const { details: copy } = useCopy(inboundShipmentFormContent)
  const { status: statusCopy } = useCopy(inboundShipmentsContent)

  // Render logic
  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="shipment-reference">{copy.reference}</FieldLabel>
            <Input
              id="shipment-reference"
              value={draft.reference}
              placeholder={copy.referencePlaceholder}
              onChange={(e) => onChange({ reference: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="shipment-status">{copy.status}</FieldLabel>
            <OptionSelect
              id="shipment-status"
              options={INBOUND_SHIPMENT_STATUSES}
              labels={statusCopy}
              value={draft.status}
              onChange={(status) => onChange({ status })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="shipment-boe">{copy.billOfEntryNo}</FieldLabel>
            <Input
              id="shipment-boe"
              value={draft.billOfEntryNo}
              className="tabular-nums"
              onChange={(e) => onChange({ billOfEntryNo: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="shipment-boe-date">{copy.billOfEntryDate}</FieldLabel>
            <DateField
              id="shipment-boe-date"
              value={draft.billOfEntryDate}
              onChange={(v) => onChange({ billOfEntryDate: v })}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="shipment-port">{copy.port}</FieldLabel>
            <Input
              id="shipment-port"
              value={draft.port}
              placeholder={copy.portPlaceholder}
              onChange={(e) => onChange({ port: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="shipment-arrived">{copy.arrivedAt}</FieldLabel>
            <DateField
              id="shipment-arrived"
              value={draft.arrivedAt}
              onChange={(v) => onChange({ arrivedAt: v })}
            />
          </Field>
        </div>
      </FieldGroup>
    </DataCard>
  )
}
