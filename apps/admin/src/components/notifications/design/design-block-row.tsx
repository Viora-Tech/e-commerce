'use client'

import type { DesignBlock } from '@commerce/notifications/design'
import { Lock, Trash2, TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { ReactNode } from 'react'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import { blockSummary, blockTitle, isLocked } from './design-state'

type DesignBlockRowProps = {
  block: DesignBlock
  handle: ReactNode
  isDragging: boolean
  selected: boolean
  /** The block has something to fix before saving (a bad link, a word that does not fill in). */
  problem: boolean
  onSelect: () => void
  onRemove: () => void
}

/**
 * One block in the editor's list: the drag handle, its name and first words, then a lock for
 * the order's own blocks or a remove button for everything else.
 */
export default function DesignBlockRow({
  block,
  handle,
  isDragging,
  selected,
  problem,
  onSelect,
  onRemove,
}: DesignBlockRowProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  const title = blockTitle(block, copy)
  const summary = blockSummary(block)
  const locked = isLocked(block)

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border bg-card py-1 pr-1 pl-0.5',
        selected ? 'border-primary' : 'border-border',
        problem && 'border-destructive',
        isDragging && 'shadow-md',
      )}
    >
      {handle}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 flex-col items-start rounded-sm px-1 py-0.5 text-left"
      >
        <span className="flex items-center gap-1 text-body font-medium text-foreground">
          {problem ? (
            <TriangleAlert aria-hidden="true" className="size-3.5 text-destructive" />
          ) : null}
          {title}
        </span>
        {summary ? (
          <span className="w-full truncate text-caption text-muted-foreground">{summary}</span>
        ) : null}
      </button>
      {locked ? (
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center text-muted-foreground"
          title={copy.editor.lockedNote}
          data-testid="block-locked"
        >
          <Lock aria-hidden="true" className="size-4" />
          <span className="sr-only">{copy.editor.lockedLabel}</span>
        </span>
      ) : (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={copy.editor.remove(title)}
          onClick={onRemove}
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  )
}
