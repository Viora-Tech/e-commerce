'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import LocationSelect, { type StoreLocation } from '@/components/inventory/location-select'
import { transferFormContent } from '@/data/inventory'

type RouteCardProps = {
  locations: StoreLocation[]
  fromLocationId: string
  toLocationId: string
  disabled: boolean
  onChange: (patch: { fromLocationId?: string; toLocationId?: string }) => void
}

const copy = transferFormContent.route

/** Origin and destination of the transfer. */
export default function RouteCard({
  locations,
  fromLocationId,
  toLocationId,
  disabled,
  onChange,
}: RouteCardProps) {
  // Render logic
  const same = fromLocationId !== '' && fromLocationId === toLocationId

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="transfer-from">{copy.from}</FieldLabel>
            <LocationSelect
              id="transfer-from"
              locations={locations}
              value={fromLocationId}
              disabled={disabled}
              onChange={(next) => onChange({ fromLocationId: next })}
              className="w-full"
            />
          </Field>
          <Field data-invalid={same || undefined}>
            <FieldLabel htmlFor="transfer-to">{copy.to}</FieldLabel>
            <LocationSelect
              id="transfer-to"
              locations={locations}
              value={toLocationId}
              disabled={disabled}
              onChange={(next) => onChange({ toLocationId: next })}
              className="w-full"
            />
            {same ? <FieldError>{copy.same}</FieldError> : null}
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
