'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import LocationSelect, { type StoreLocation } from '@/components/inventory/location-select'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

type DestinationCardProps = {
  locations: StoreLocation[]
  locationId: string
  expectedAt: string
  /** The location is fixed once ordered; the date stays editable. */
  locationLocked: boolean
  disabled: boolean
  onChange: (patch: { locationId?: string; expectedAt?: string }) => void
}

/** Where the stock lands and when it is expected. */
export default function DestinationCard({
  locations,
  locationId,
  expectedAt,
  locationLocked,
  disabled,
  onChange,
}: DestinationCardProps) {
  // Hooks
  const { destination: copy } = useCopy(purchaseOrderFormContent)

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="po-location">{copy.location}</FieldLabel>
            <LocationSelect
              id="po-location"
              locations={locations}
              value={locationId}
              disabled={disabled || locationLocked}
              onChange={(next) => onChange({ locationId: next })}
              className="w-full"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="po-expected">{copy.expected}</FieldLabel>
            <Input
              id="po-expected"
              type="date"
              value={expectedAt}
              disabled={disabled}
              onChange={(e) => onChange({ expectedAt: e.target.value })}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
