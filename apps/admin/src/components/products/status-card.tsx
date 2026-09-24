'use client'

import type { ProductStatus } from '@commerce/core/catalog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import SuggestInput from '@/components/fields/suggest-input'
import KitField from '@/components/kit/kit-field'
import DataCard from '@/components/layout/data-card'
import { productFormContent } from '@/data/products'
import type { Facets } from './form-state'

const copy = productFormContent

const statusItems = Object.fromEntries(copy.status.options.map((o) => [o.value, o.label]))

type StatusCardProps = {
  status: ProductStatus
  vendor: string
  facets: Facets
  onChange: (status: ProductStatus) => void
  onVendor: (vendor: string) => void
}

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
  // Render logic
  return (
    <DataCard title={copy.status.heading}>
      <div className="flex flex-col gap-4">
        <KitField
          label={copy.status.label}
          htmlFor="product-status"
          help={copy.status.help[status]}
        >
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
        </KitField>
        <KitField label={copy.organisation.vendor} htmlFor="product-vendor">
          <SuggestInput
            id="product-vendor"
            size="kit"
            value={vendor}
            suggestions={facets.vendors}
            onChange={onVendor}
          />
        </KitField>
      </div>
    </DataCard>
  )
}
