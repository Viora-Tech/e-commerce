'use client'

import type { DesignBlock } from '@commerce/notifications/design'
import SortableStack from '@/components/layout/sortable-stack'
import { emailDesignContent } from '@/data/email-design'
import { useCopy } from '@/hooks/use-copy'
import DesignBlockRow from './design-block-row'
import { blockProblem, blockTitle } from './design-state'

type DesignBlockListProps = {
  blocks: DesignBlock[]
  selected: string | null
  variables: readonly string[]
  onReorder: (blocks: DesignBlock[]) => void
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

/** The email's blocks top to bottom; drag a row (or use the keyboard) to move it. */
export default function DesignBlockList({
  blocks,
  selected,
  variables,
  onReorder,
  onSelect,
  onRemove,
}: DesignBlockListProps) {
  // Hooks
  const copy = useCopy(emailDesignContent)

  // Render logic
  return (
    <section aria-label={copy.editor.blocks} className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold text-muted-foreground">{copy.editor.blocks}</h3>
      <SortableStack
        items={blocks}
        onReorder={onReorder}
        getTitle={(b) => blockTitle(b, copy)}
        labels={copy.sortable}
        className="flex flex-col gap-1.5"
        renderItem={(block, { handle, isDragging }) => (
          <DesignBlockRow
            block={block}
            handle={handle}
            isDragging={isDragging}
            selected={selected === block.id}
            problem={blockProblem(block, variables) !== null}
            onSelect={() => onSelect(block.id)}
            onRemove={() => onRemove(block.id)}
          />
        )}
      />
    </section>
  )
}
