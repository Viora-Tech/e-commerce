'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { productFormContent } from '@/data/products'

const copy = productFormContent

const statusItems = Object.fromEntries(copy.status.options.map((o) => [o.value, o.label]))

type StatusCardProps = { status: ProductStatus; onChange: (status: ProductStatus) => void }

export function StatusCard({ status, onChange }: StatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.status.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="product-status" className="sr-only">
            {copy.status.label}
          </FieldLabel>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(s) => onChange(s as ProductStatus)}
          >
            <SelectTrigger id="product-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {copy.status.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{copy.status.help[status]}</FieldDescription>
        </Field>
      </CardContent>
    </Card>
  )
}
