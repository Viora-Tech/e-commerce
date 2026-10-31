'use client'

import PhoneInput from '@commerce/ui/phone-input'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import NewSupplierDialog, { type PickedSupplier } from '@/components/suppliers/new-supplier-dialog'
import SupplierPicker from '@/components/suppliers/supplier-picker'
import { purchaseOrderFormContent } from '@/data/inventory'
import { supplierPickerContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SupplierCardProps = {
  supplierId: string | null
  name: string
  email: string
  phone: string
  disabled: boolean
  onChange: (patch: {
    supplierId?: string | null
    supplierName?: string
    supplierEmail?: string
    supplierPhone?: string
  }) => void
  onPick: (supplier: PickedSupplier) => void
}

/** Who the stock is ordered from: a saved supplier, or a name typed for this order. */
export default function SupplierCard({
  supplierId,
  name,
  email,
  phone,
  disabled,
  onChange,
  onPick,
}: SupplierCardProps) {
  // Hooks
  const { supplier: copy } = useCopy(purchaseOrderFormContent)
  const picker = useCopy(supplierPickerContent)
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSaved = (supplier: PickedSupplier) => {
    setSaving(false)
    onPick(supplier)
  }

  // Render logic
  const typedOnly = !supplierId && !disabled && name.trim() !== ''

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        {supplierId ? (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="text-caption text-muted-foreground">{picker.linked}</span>
              <Link
                href={routes.stock.supplier(supplierId)}
                className="truncate text-body-strong hover:underline"
              >
                {name}
              </Link>
            </span>
            {disabled ? null : (
              <Button variant="ghost" onClick={() => onChange({ supplierId: null })}>
                {picker.change}
              </Button>
            )}
          </div>
        ) : disabled ? null : (
          <SupplierPicker onPick={onPick} />
        )}
        <Field>
          <FieldLabel htmlFor="po-supplier">{copy.name}</FieldLabel>
          <Input
            id="po-supplier"
            size="lg"
            value={name}
            disabled={disabled}
            onChange={(e) => onChange({ supplierName: e.target.value })}
          />
          {typedOnly ? (
            <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
              <span>{picker.saveTypedHelp}</span>
              <Button variant="outline" size="sm" onClick={() => setSaving(true)}>
                {picker.saveTyped}
              </Button>
            </div>
          ) : null}
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
            <PhoneInput
              id="po-phone"
              value={phone}
              onChange={(supplierPhone) => onChange({ supplierPhone })}
              disabled={disabled}
              autoComplete="tel"
            />
          </Field>
        </div>
      </FieldGroup>
      {saving ? (
        <NewSupplierDialog
          open={saving}
          initialName={name.trim()}
          initialEmail={email}
          initialPhone={phone}
          onOpenChange={setSaving}
          onCreated={handleSaved}
        />
      ) : null}
    </DataCard>
  )
}
