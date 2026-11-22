'use client'

import type { DesignBlock } from '@commerce/notifications/design'
import {
  SortableContext,
  type SortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import SortableStackItem from '@/components/layout/sortable-stack-item'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockRow from './design-block-row'
import DesignEndZone from './design-end-zone'
import { blockProblem, blockTitle } from './design-state'

type DesignBlockListProps = {
  blocks: DesignBlock[]
  selected: string | null
  variables: readonly string[]
  /** While a palette tile is dragged: the block the new one would go above (null: none yet). */
  insertBefore: string | null
  /** A palette tile is being dragged (the end zone shows). */
  adding: boolean
  /** The email holds the most blocks it can (Duplicate is off). */
  full: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
}

/** Rows make room only for a row being moved; a new block from the palette shows a line instead. */
const rowsOnly: SortingStrategy = (args) =>
  args.activeIndex === -1 ? null : verticalListSortingStrategy(args)

/**
 * The email's blocks top to bottom. Sits inside DesignOutline's drag context: drag a row by its
 * grip (or Space and the arrow keys) to move it; palette tiles drop between rows.
 */
export default function DesignBlockList({
  blocks,
  selected,
  variables,
  insertBefore,
  adding,
  full,
  onSelect,
  onRemove,
  onDuplicate,
}: DesignBlockListProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)
  const prefersReducedMotion = useReducedMotion()

  // Render logic
  return (
    <section aria-label={copy.editor.blocks} className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold text-muted-foreground">{copy.editor.blocks}</h3>
      <SortableContext items={blocks.map((b) => b.id)} strategy={rowsOnly}>
        <ul className="flex flex-col gap-1.5">
          {blocks.map((block) => (
            <SortableStackItem
              key={block.id}
              id={block.id}
              handleLabel={copy.sortable.handle(blockTitle(block, copy))}
              scale={1}
              reduced={prefersReducedMotion === true}
            >
              {({ handle, isDragging }) => (
                <DesignBlockRow
                  block={block}
                  handle={handle}
                  isDragging={isDragging}
                  selected={selected === block.id}
                  dropAbove={insertBefore === block.id}
                  full={full}
                  problem={blockProblem(block, variables) !== null}
                  onSelect={() => onSelect(block.id)}
                  onRemove={() => onRemove(block.id)}
                  onDuplicate={() => onDuplicate(block.id)}
                />
              )}
            </SortableStackItem>
          ))}
        </ul>
      </SortableContext>
      <DesignEndZone active={adding} label={copy.editor.dropEnd} />
    </section>
  )
}
