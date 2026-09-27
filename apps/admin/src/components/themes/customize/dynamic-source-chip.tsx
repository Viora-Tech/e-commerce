'use client'

import { DynamicSource, XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { dynamicSourcesContent as copy } from '@/data/dynamic-sources'

type DynamicSourceChipProps = {
  /** "Product › Title". */
  name: string
  disabled?: boolean | undefined
  onChange: () => void
  onDisconnect: () => void
}

/** A connected setting: the source's name (tap to pick another) and a ✕ to disconnect. */
export default function DynamicSourceChip({
  name,
  disabled,
  onChange,
  onDisconnect,
}: DynamicSourceChipProps) {
  return (
    <div className="flex min-h-8 items-center gap-1 rounded-lg border border-primary/40 bg-primary/5 pr-1 pl-2.5">
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        title={copy.change}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 text-left text-[0.8125rem] text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
      >
        <DynamicSource aria-hidden className="size-3.5 shrink-0 text-primary" />
        <span className="sr-only">{copy.connectedTo}</span>
        <span className="min-w-0 truncate">{name}</span>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDisconnect}
        disabled={disabled}
        aria-label={copy.disconnect}
        title={copy.disconnect}
        className="size-6 rounded-md text-muted-foreground hover:text-foreground"
      >
        <XIcon aria-hidden className="size-3.5" />
      </Button>
    </div>
  )
}
