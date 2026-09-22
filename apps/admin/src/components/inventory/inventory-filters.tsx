'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { inventoryContent, type StockState } from '@/data/inventory'
import FilterSelect from './filter-select'

export type InventoryFilterValues = {
  stock: StockState | null
  vendor: string | null
  productType: string | null
}

type InventoryFiltersProps = {
  values: InventoryFilterValues
  facets: { vendors: string[]; types: string[] }
  onChange: (patch: Partial<InventoryFilterValues>) => void
  onClear: () => void
}

const copy = inventoryContent.filters

const asOptions = (values: string[]) => values.map((v) => ({ value: v, label: v }))

/** Contents of the filter popover on the inventory table. */
export default function InventoryFilters({
  values,
  facets,
  onChange,
  onClear,
}: InventoryFiltersProps) {
  return (
    <div className="flex w-64 flex-col gap-4">
      <FilterSelect
        id="inventory-stock"
        label={copy.stock}
        value={values.stock}
        options={copy.stockOptions}
        onChange={(stock) => onChange({ stock: stock as StockState | null })}
      />
      <FilterSelect
        id="inventory-vendor"
        label={copy.vendor}
        value={values.vendor}
        options={asOptions(facets.vendors)}
        onChange={(vendor) => onChange({ vendor })}
      />
      <FilterSelect
        id="inventory-type"
        label={copy.productType}
        value={values.productType}
        options={asOptions(facets.types)}
        onChange={(productType) => onChange({ productType })}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
