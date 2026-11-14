'use client'

import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import SearchField from '@/components/fields/search-field'
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
      <SearchField
        className="min-w-48 flex-1"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={copy.search}
        aria-label={copy.search}
        autoComplete="off"
      />
      {canGroup ? (
        <div className="flex items-center gap-2 text-body text-muted-foreground">
          <label htmlFor="variant-group-by">{copy.groupBy}</label>
          <NativeSelect
            id="variant-group-by"
            value={groupBy == null ? NONE : String(groupBy)}
            onChange={(e) => handleGroupBy(e.target.value)}
          >
            <NativeSelectOption value={NONE}>{copy.noGrouping}</NativeSelectOption>
            {optionNames.map((name, i) => (
              <NativeSelectOption key={name} value={String(i)}>
                {name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <span className="ml-auto text-body-strong text-ink-strong">
        {variantsCopy.footer.stockAcross(stock, variantCount)}
      </span>
    </div>
  )
}
