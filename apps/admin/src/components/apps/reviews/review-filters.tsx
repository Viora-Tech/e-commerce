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
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'

export type ReviewFilterValues = {
  rating: number | null
  product: string | null
  photos: 'yes' | 'no' | null
}

type Option = { value: string; label: string }

type ReviewFiltersProps = {
  values: ReviewFilterValues
  products: { id: string; title: string }[]
  onChange: (patch: Partial<ReviewFilterValues>) => void
  onClear: () => void
}

/** Select needs a value, so this stands for "no filter". */
const ANY = '__any'

type FilterSelectProps = {
  id: string
  label: string
  any: string
  value: string | null
  options: Option[]
  onChange: (next: string | null) => void
}

function FilterSelect({ id, label, any, value, options, onChange }: FilterSelectProps) {
  const items = Object.fromEntries([[ANY, any], ...options.map((o) => [o.value, o.label])])
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
          <SelectItem value={ANY}>{any}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/** Contents of the filter popover on the reviews list: rating, product, photos. */
export default function ReviewFilters({ values, products, onChange, onClear }: ReviewFiltersProps) {
  // Hooks
  const { list } = useCopy(reviewsContent)

  // Render logic
  const copy = list.filters
  const ratings = [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: copy.ratingValue(n) }))

  return (
    <div className="flex w-64 flex-col gap-4">
      <FilterSelect
        id="review-filter-rating"
        label={copy.rating}
        any={copy.any}
        value={values.rating ? String(values.rating) : null}
        options={ratings}
        onChange={(v) => onChange({ rating: v ? Number(v) : null })}
      />
      <FilterSelect
        id="review-filter-product"
        label={copy.product}
        any={copy.any}
        value={values.product}
        options={products.map((p) => ({ value: p.id, label: p.title }))}
        onChange={(product) => onChange({ product })}
      />
      <FilterSelect
        id="review-filter-photos"
        label={copy.photos}
        any={copy.any}
        value={values.photos}
        options={[
          { value: 'yes', label: copy.yes },
          { value: 'no', label: copy.no },
        ]}
        onChange={(v) => onChange({ photos: v === 'yes' || v === 'no' ? v : null })}
      />
      <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
        {copy.clear}
      </Button>
    </div>
  )
}
