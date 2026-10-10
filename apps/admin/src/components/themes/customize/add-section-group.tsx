'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { type ReactNode, useId } from 'react'
import { customizeContent } from '@/data/customize'
import { CHROME_FOCUS } from '@/lib/customize-chrome'

type AddSectionGroupProps = {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

const copy = customizeContent.addSection

/**
 * One category of the Add panel (Figma 369:4912 "Left panel / Stack"): a 14px semibold heading
 * with a chevron that folds the group, its content below, a hairline under the group.
 */
export default function AddSectionGroup({ title, open, onToggle, children }: AddSectionGroupProps) {
  // Hooks
  const bodyId = useId()

  // Render logic
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-3 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        title={copy.toggleGroup(title)}
        className={cn(
          'flex h-5 w-full items-center gap-2 rounded-md text-left text-sm leading-5 font-semibold text-foreground',
          CHROME_FOCUS,
        )}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none',
            !open && '-rotate-90',
          )}
        />
      </button>
      {open ? <div id={bodyId}>{children}</div> : null}
    </section>
  )
}
