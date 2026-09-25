'use client'

import type { TemplateSection } from '@commerce/core/theme'
import { Copy, Eye, EyeOff, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { customizeContent } from '@/data/customize'
import SectionIcon from './section-icon'

type SectionRowProps = {
  section: TemplateSection
  label: string
  selected: boolean
  /** Main sections and the header and footer can only move. */
  locked: boolean
  handle: ReactNode
  onSelect: () => void
  onToggleHidden: () => void
  onDuplicate: () => void
  /** Passed this row's own element, so the caller can collapse it before dispatching. */
  onRemove: (el: HTMLElement | null) => void
}

const copy = customizeContent.tree

/** One section in the tree: grip, glyph, name, and hover actions (eye, duplicate, remove). */
export default function SectionRow({
  section,
  label,
  selected,
  locked,
  handle,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onRemove,
}: SectionRowProps) {
  // Hooks
  const rowRef = useRef<HTMLDivElement>(null)

  // Render logic
  const hidden = section.props._hidden === true

  return (
    <div
      ref={rowRef}
      className={cn(
        'group flex h-9 items-center gap-1 rounded-md pr-1 text-body transition-colors',
        selected ? 'bg-accent text-foreground' : 'text-foreground hover:bg-muted',
      )}
    >
      <span className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        {handle}
      </span>
      <button
        type="button"
        onClick={onSelect}
        aria-label={copy.select(label)}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 text-left',
          hidden && 'text-muted-foreground',
        )}
      >
        <SectionIcon type={section.type} className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </button>
      <div
        className={cn(
          'flex items-center transition-opacity duration-150',
          !hidden && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleHidden}
          aria-label={hidden ? copy.show(label) : copy.hide(label)}
          title={hidden ? copy.show(label) : copy.hide(label)}
        >
          {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        {locked ? null : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDuplicate}
              aria-label={copy.duplicate(label)}
              title={copy.duplicate(label)}
            >
              <Copy aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onRemove(rowRef.current)}
              aria-label={copy.remove(label)}
              title={copy.remove(label)}
            >
              <Trash2 aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
