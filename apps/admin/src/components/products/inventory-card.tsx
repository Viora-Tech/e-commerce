'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { MoneyInput } from '@/components/fields/money-input'
import { productFormContent } from '@/data/products'
import type { VariantRow } from './form-state'

type InventoryCardProps = {
  variant: VariantRow
  /** Quantity differs from what is saved, so a reason is needed. */
  quantityChanged: boolean
  reason: InventoryReason
  onChange: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
}

const copy = productFormContent.inventory

const reasonItems = Object.fromEntries(copy.reasons.map((r) => [r.value, r.label]))

export function InventoryCard({
  variant,
  quantityChanged,
  reason,
  onChange,
  onReason,
}: InventoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-sku">{copy.sku}</FieldLabel>
              <Input
                id="variant-sku"
                value={variant.sku}
                onChange={(e) => onChange({ sku: e.target.value })}
                autoComplete="off"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-barcode">{copy.barcode}</FieldLabel>
              <Input
                id="variant-barcode"
                value={variant.barcode}
                onChange={(e) => onChange({ barcode: e.target.value })}
                autoComplete="off"
              />
            </Field>
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="variant-track"
              checked={variant.trackInventory}
              onCheckedChange={(v) => onChange({ trackInventory: Boolean(v) })}
            />
            <FieldLabel htmlFor="variant-track" className="font-normal">
              {copy.track}
            </FieldLabel>
          </Field>
          {variant.trackInventory ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="variant-quantity">{copy.quantity}</FieldLabel>
                <MoneyInput
                  id="variant-quantity"
                  currency={false}
                  value={variant.quantity}
                  onChange={(quantity) => onChange({ quantity })}
                />
              </Field>
              {quantityChanged ? (
                <Field>
                  <FieldLabel htmlFor="inventory-reason">{copy.reason}</FieldLabel>
                  <Select
                    items={reasonItems}
                    value={reason}
                    onValueChange={(r) => onReason(r as InventoryReason)}
                  >
                    <SelectTrigger id="inventory-reason" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {copy.reasons.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-weight">{copy.weight}</FieldLabel>
              <MoneyInput
                id="variant-weight"
                currency={false}
                suffix="g"
                value={variant.weight}
                onChange={(weight) => onChange({ weight })}
              />
              <FieldDescription>{copy.weightHelp}</FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
