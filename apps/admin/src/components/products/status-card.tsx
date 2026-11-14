'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import ComboInput from '@/components/fields/combo-input'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { Facets } from './form-state'

type StatusCardProps = {
  status: ProductStatus
  vendor: string
  facets: Facets
  onChange: (status: ProductStatus) => void
  onVendor: (vendor: string) => void
}

/** Suppliers offered as vendors; Stock → Suppliers rarely holds more than a page. */
const SUPPLIERS_MAX = 100

/**
 * Publishing state and vendor. The frame's Publish and Save to draft buttons
 * cover active and draft; archiving still needs a control, so it lives here.
 */
export default function StatusCard({
  status,
  vendor,
  facets,
  onChange,
  onVendor,
}: StatusCardProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const [suppliers, setSuppliers] = useState<string[]>([])

  /* Members without stock access just get the vendors already used on products. */
  useEffect(() => {
    api.suppliers
      .list({ perPage: SUPPLIERS_MAX })
      .then((r) => setSuppliers(r.rows.map((s) => s.name)))
      .catch(() => setSuppliers([]))
  }, [])

  // Render logic
  const statusItems = Object.fromEntries(copy.status.options.map((o) => [o.value, o.label]))
  const supplierKeys = new Set(suppliers.map((s) => s.toLowerCase()))
  const vendorGroups = [
    { label: copy.organisation.vendorSuppliers, items: suppliers },
    {
      label: copy.organisation.vendorUsed,
      items: facets.vendors.filter((v) => !supplierKeys.has(v.toLowerCase())),
    },
  ]

  return (
    <DataCard title={copy.status.heading}>
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="product-status">{copy.status.label}</FieldLabel>
          <Select
            items={statusItems}
            value={status}
            onValueChange={(s) => onChange(s as ProductStatus)}
          >
            <SelectTrigger size="lg" id="product-status" className="w-full">
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
        <Field>
          <FieldLabel htmlFor="product-vendor">{copy.organisation.vendor}</FieldLabel>
          <ComboInput
            id="product-vendor"
            value={vendor}
            groups={vendorGroups}
            onChange={onVendor}
            placeholder={copy.organisation.vendorPlaceholder}
          />
        </Field>
      </div>
    </DataCard>
  )
}
