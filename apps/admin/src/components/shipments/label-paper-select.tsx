'use client'

import { LABEL_SHEET_FORMATS, type LabelSheetFormat } from '@commerce/core/label-sheet-layout'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { labelSheetContent } from '@/data/label-sheet'
import { useCopy } from '@/hooks/use-copy'

type LabelPaperSelectProps = {
  value: LabelSheetFormat
  onChange: (format: LabelSheetFormat) => void
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

/** The paper a batch of labels prints on: 4 × 6 thermal, A4 four-up, or the courier's own size. */
export default function LabelPaperSelect({
  value,
  onChange,
  size = 'lg',
  className,
}: LabelPaperSelectProps) {
  // Hooks
  const copy = useCopy(labelSheetContent)

  // Render logic
  const items: Record<string, string> = copy.formats

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => {
        const next = LABEL_SHEET_FORMATS.find((f) => f === v)
        if (next) onChange(next)
      }}
    >
      <SelectTrigger size={size} aria-label={copy.paper} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LABEL_SHEET_FORMATS.map((f) => (
          <SelectItem key={f} value={f}>
            {copy.formats[f]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
