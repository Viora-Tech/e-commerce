'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { productsListContent } from '@/data/products'

export type StockFilter = 'in' | 'out' | 'low'

export type ProductFilterValues = {
  vendor: string | null
  productType: string | null
  tag: string | null
  stock: StockFilter | null
}

type ProductFiltersProps = {
  values: ProductFilterValues
  facets: { vendors: string[]; productTypes: string[]; tags: string[] }
  onChange: (patch: Partial<ProductFilterValues>) => void
  onClear: () => void
}

const copy = productsListContent.filters
const ANY = '__any'

/** One select per facet; `__any` stands for no filter because Select needs a value. */
function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  options: string[]
  onChange: (next: string | null) => void
}) {
  const items = Object.fromEntries([[ANY, copy.any], ...options.map((o) => [o, o])])
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select
        items={items}
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? null : String(next))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{copy.any}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Contents of the filter popover on the product list. */
export default function ProductFilters({ values, facets, onChange, onClear }: ProductFiltersProps) {
  // Render logic
  const stockItems = Object.fromEntries([
    [ANY, copy.any],
    ...copy.stockOptions.map((o) => [o.value, o.label]),
  ])

  return (
    <div className="flex w-64 flex-col gap-4">
      <FilterSelect
        id="filter-vendor"
        label={copy.vendor}
        value={values.vendor}
        options={facets.vendors}
        onChange={(vendor) => onChange({ vendor })}
      />
      <FilterSelect
        id="filter-type"
        label={copy.productType}
        value={values.productType}
        options={facets.productTypes}
        onChange={(productType) => onChange({ productType })}
      />
      <FilterSelect
        id="filter-tag"
        label={copy.tag}
        value={values.tag}
        options={facets.tags}
        onChange={(tag) => onChange({ tag })}
      />
      <Field>
        <FieldLabel htmlFor="filter-stock">{copy.stock}</FieldLabel>
        <Select
          items={stockItems}
          value={values.stock ?? ANY}
          onValueChange={(next) =>
            onChange({ stock: next === ANY ? null : (String(next) as StockFilter) })
          }
        >
          <SelectTrigger id="filter-stock" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{copy.any}</SelectItem>
            {copy.stockOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
