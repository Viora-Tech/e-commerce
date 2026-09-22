'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { purchaseOrderFormContent } from '@/data/inventory'

type SupplierCardProps = {
  name: string
  email: string
  phone: string
  disabled: boolean
  onChange: (patch: {
    supplierName?: string
    supplierEmail?: string
    supplierPhone?: string
  }) => void
}

const copy = purchaseOrderFormContent.supplier

/** Who the stock is ordered from. */
export default function SupplierCard({
  name,
  email,
  phone,
  disabled,
  onChange,
}: SupplierCardProps) {
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="po-supplier">{copy.name}</FieldLabel>
            <Input
              id="po-supplier"
              size="lg"
              value={name}
              disabled={disabled}
              onChange={(e) => onChange({ supplierName: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="po-email">{copy.email}</FieldLabel>
              <Input
                id="po-email"
                type="email"
                value={email}
                disabled={disabled}
                onChange={(e) => onChange({ supplierEmail: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="po-phone">{copy.phone}</FieldLabel>
              <Input
                id="po-phone"
                type="tel"
                value={phone}
                disabled={disabled}
                onChange={(e) => onChange({ supplierPhone: e.target.value })}
              />
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
