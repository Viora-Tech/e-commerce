'use client'

import {
  INBOUND_CARRIER_IDS,
  INBOUND_CARRIERS,
  type InboundCarrier,
  inboundTrackingCourier,
  inboundTrackingUrl,
} from '@commerce/core/inventory'
import { ExternalLink, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import OptionSelect from '@/components/landed-cost/option-select'
import DataCard from '@/components/layout/data-card'
import { inboundShipmentFormContent } from '@/data/purchasing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { ShipmentDraft } from './shipment-details-card'

type ShipmentTrackingCardProps = {
  draft: ShipmentDraft
  /** When the carrier's tracking was last read; null when the date was typed. */
  trackedAt: Date | string | null
  /** Saved with a tracking number, so "Check tracking" can run. */
  canTrack: boolean
  tracking: boolean
  onChange: (patch: Partial<ShipmentDraft>) => void
  onTrack: () => void
}

const NONE = 'none'
type CarrierChoice = InboundCarrier | typeof NONE

/**
 * Who carries the consignment, its tracking number and page, and when it should arrive. With
 * FedEx, DHL Express, Blue Dart or Delhivery connected as a shipping app, the expected date is
 * read from their tracking on save and with "Check tracking".
 */
export default function ShipmentTrackingCard({
  draft,
  trackedAt,
  canTrack,
  tracking,
  onChange,
  onTrack,
}: ShipmentTrackingCardProps) {
  // Hooks
  const { tracking: copy } = useCopy(inboundShipmentFormContent)
  const fmt = useFormat()

  // Render logic
  const choices: CarrierChoice[] = [NONE, ...INBOUND_CARRIER_IDS]
  const labels = Object.fromEntries([
    [NONE, copy.noCarrier],
    ...INBOUND_CARRIER_IDS.map((id) => [
      id,
      id === 'other' ? copy.other : INBOUND_CARRIERS[id].label,
    ]),
  ]) as Record<CarrierChoice, string>
  const link = inboundTrackingUrl(draft.carrier, draft.trackingNumber, draft.trackingUrl)
  const live = inboundTrackingCourier(draft.carrier) !== null

  return (
    <DataCard
      title={copy.heading}
      action={
        canTrack && live ? (
          <Button variant="outline" size="sm" onClick={onTrack} disabled={tracking}>
            <RefreshCw aria-hidden="true" />
            {tracking ? copy.checking : copy.check}
          </Button>
        ) : null
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="shipment-carrier">{copy.carrier}</FieldLabel>
          <OptionSelect
            id="shipment-carrier"
            options={choices}
            labels={labels}
            value={draft.carrier ?? NONE}
            onChange={(v) => onChange({ carrier: v === NONE ? null : v })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shipment-tracking-number">{copy.number}</FieldLabel>
          <Input
            id="shipment-tracking-number"
            value={draft.trackingNumber}
            className="tabular-nums"
            onChange={(e) => onChange({ trackingNumber: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="shipment-tracking-url">{copy.url}</FieldLabel>
          <Input
            id="shipment-tracking-url"
            type="url"
            value={draft.trackingUrl}
            placeholder={copy.urlPlaceholder}
            onChange={(e) => onChange({ trackingUrl: e.target.value })}
          />
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-caption text-link hover:underline"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {copy.open}
            </a>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="shipment-expected">{copy.expected}</FieldLabel>
          <Input
            id="shipment-expected"
            type="date"
            value={draft.expectedAt}
            onChange={(e) => onChange({ expectedAt: e.target.value })}
          />
          <FieldDescription>
            {trackedAt
              ? copy.readAt(fmt.dateTime(trackedAt))
              : live
                ? copy.liveHint
                : copy.manualHint}
          </FieldDescription>
        </Field>
      </FieldGroup>
    </DataCard>
  )
}
