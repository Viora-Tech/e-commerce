'use client'

import { Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type VariantToolbarProps = {
  query: string
  /** Names of the options that build the matrix, in order. */
  optionNames: string[]
  /** Index into `optionNames`, or null for a flat list. */
  groupBy: number | null
  /** Units on hand across all tracked variants. */
  stock: number
  variantCount: number
  onQuery: (query: string) => void
  onGroupBy: (groupBy: number | null) => void
}

const NONE = 'none'

/** Above the variants table: search, "Group by", and the product's total stock. */
export default function VariantToolbar({
  query,
  optionNames,
  groupBy,
  stock,
  variantCount,
  onQuery,
  onGroupBy,
}: VariantToolbarProps) {
  // Hooks
  const { variantGroups: copy, variants: variantsCopy } = useCopy(productFormContent)

  // Event handlers
  const handleGroupBy = (value: string) => onGroupBy(value === NONE ? null : Number(value))

  // Render logic
  const canGroup = optionNames.length >= 2

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={copy.search}
          aria-label={copy.search}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      {canGroup ? (
        <label className="flex items-center gap-2 text-body text-muted-foreground">
          {copy.groupBy}
          <NativeSelect
            value={groupBy == null ? NONE : String(groupBy)}
            onChange={(e) => handleGroupBy(e.target.value)}
          >
            <NativeSelectOption value={NONE}>{copy.noGrouping}</NativeSelectOption>
            {optionNames.map((name, i) => (
              <NativeSelectOption key={`${name}-${i}`} value={String(i)}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
      ) : null}
      <span className="ml-auto text-body-strong text-ink-strong">
        {variantsCopy.footer.stockAcross(stock, variantCount)}
      </span>
    </div>
  )
}
