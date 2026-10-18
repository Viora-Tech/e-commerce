'use client'

import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type ChoiceChipProps = {
  label: string
  selected: boolean
  onSelect: () => void
}

export default function ChoiceChip({ label, selected, onSelect }: ChoiceChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-[background-color,color,border-color,scale] duration-(--duration-press) ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-(--motion-press-scale)',
        selected
          ? 'border-transparent bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-border-strong',
      )}
    >
      {selected ? <CheckIcon className="size-3.5" /> : null}
      {label}
    </button>
  )
}
