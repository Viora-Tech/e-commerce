'use client'

import { Plus, Store } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { themeImportContent } from '@/data/theme-import'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'

type ImportedSectionCardProps = {
  name: string
  onAdd: () => void
}

/**
 * A section of the imported Shopify theme in the Add panel: the same tile as a library section,
 * with a small "Shopify" badge. Click to add; it is not draggable, because Puck drags a
 * component type and an imported section needs its theme section's settings, not defaults.
 */
export default function ImportedSectionCard({ name, onAdd }: ImportedSectionCardProps) {
  // Hooks
  const copy = useCopy(themeImportContent.addPanel)

  // Render logic
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={copy.cardLabel(name)}
      className={cn(
        'group/card flex w-full min-w-0 flex-col gap-1.5 rounded-lg text-left',
        CHROME_TRANSITION,
        CHROME_FOCUS,
      )}
    >
      <span className="truncate text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {name}
      </span>
      <span className="relative flex aspect-[128/88] w-full items-center justify-center overflow-hidden rounded-[0.625rem] border border-border bg-muted transition-[border-color,box-shadow] group-hover/card:border-primary group-hover/card:shadow-lift group-focus-visible/card:border-primary">
        <Store aria-hidden className="size-6 text-muted-foreground" />
        <span className="absolute top-1.5 left-1.5 rounded bg-card px-1.5 text-[0.625rem] leading-4 font-semibold text-foreground ring-1 ring-border">
          {copy.badge}
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover/card:opacity-100 group-focus-visible/card:opacity-100 motion-reduce:transition-none">
          <span className="flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground shadow-sm">
            <Plus aria-hidden className="size-3" />
            {customizeContent.addSection.add}
          </span>
        </span>
      </span>
    </button>
  )
}
