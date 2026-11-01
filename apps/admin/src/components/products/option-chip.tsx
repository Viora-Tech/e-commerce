'use client'

import { Pencil } from '@commerce/ui/icons'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import type { OptionRow } from './form-state'

type OptionChipProps = {
  option: OptionRow
  onEdit: () => void
}

/** Values shown on the chip before "+N more". */
const SHOWN_VALUES = 6

/** A folded option, "Size  S M L XL": click to open its editor. */
export default function OptionChip({ option, onEdit }: OptionChipProps) {
  // Hooks
  const { variants: copy } = useCopy(productFormContent)

  // Render logic
  const values = option.values.filter((v) => v.trim())
  const extra = values.length - SHOWN_VALUES

  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={copy.editOption(option.name)}
      className="motion-press flex w-full flex-wrap items-center gap-2 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/50"
    >
      <span className="min-w-24 text-body-strong text-ink-strong">{option.name}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {values.slice(0, SHOWN_VALUES).map((value) => (
          <span
            key={value}
            className="rounded-md bg-muted px-2 py-0.5 text-caption text-ink-strong"
          >
            {value}
          </span>
        ))}
        {extra > 0 ? (
          <span className="px-1 py-0.5 text-caption text-muted-foreground">
            {copy.moreValues(extra)}
          </span>
        ) : null}
      </span>
      <Pencil aria-hidden="true" className="size-4 text-muted-foreground" />
    </button>
  )
}
