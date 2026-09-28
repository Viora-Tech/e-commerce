'use client'

import { Plus, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { customizeContent } from '@/data/customize'
import { CHROME_FOCUS, CHROME_ROW_HOVER, CHROME_TRANSITION } from '@/lib/customize-chrome'
import type { BlockList } from '@/lib/customize-insert'

type SectionBlocksProps = {
  lists: BlockList[]
  onSelect: () => void
  onAdd: (key: string) => void
  onRemove: (key: string, index: number) => void
}

const copy = customizeContent.tree

const ADD_ROW = cn(
  'flex h-8 w-full items-center gap-2 rounded-lg pl-2 text-left text-xs text-muted-foreground data-[popup-open]:bg-muted/60',
  CHROME_ROW_HOVER,
  CHROME_TRANSITION,
  CHROME_FOCUS,
)

/**
 * The blocks nested under a section (its slides, columns, logos …), with
 * "+ Add block" at the end. A block row selects its section, whose settings
 * list the same items; adding and removing go through the section's props, so
 * they are single undo steps like any other edit.
 */
export default function SectionBlocks({ lists, onSelect, onAdd, onRemove }: SectionBlocksProps) {
  // Hooks
  const reducedMotion = useReducedMotion()

  // Render logic
  const addable = lists.filter((l) => l.canAdd)
  const rows = lists.flatMap((list) =>
    list.blocks.map((block) => ({ ...block, canRemove: list.canRemove })),
  )
  const addIcon = (
    <span className="flex size-4 items-center justify-center rounded-sm text-muted-foreground">
      <Plus aria-hidden className="size-3.5" />
    </span>
  )

  return (
    // The hairline on the left is the tree's indent guide, lined up under the parent's chevron.
    <div className="ml-6 flex flex-col border-l border-border/80 py-0.5 pl-1.5">
      <AnimatePresence initial={false}>
        {rows.map((block) => (
          <motion.div
            key={`${block.key}-${block.index}`}
            initial={reducedMotion ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
            className="group/block relative overflow-hidden"
          >
            <button
              type="button"
              onClick={onSelect}
              aria-label={copy.selectBlock(block.title)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-lg pr-8 pl-2 text-left text-[0.8125rem] text-foreground/80',
                CHROME_ROW_HOVER,
                CHROME_TRANSITION,
                CHROME_FOCUS,
              )}
            >
              <span aria-hidden className="size-1 shrink-0 rounded-full bg-muted-foreground/60" />
              <span className="truncate">{block.title}</span>
            </button>
            {block.canRemove ? (
              <button
                type="button"
                onClick={() => onRemove(block.key, block.index)}
                aria-label={copy.removeBlock(block.title)}
                title={copy.removeBlock(block.title)}
                className={cn(
                  'absolute top-1/2 right-1 hidden size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground group-hover/block:flex group-focus-within/block:flex hover:bg-muted hover:text-foreground',
                  CHROME_FOCUS,
                )}
              >
                <X aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
      {addable.length === 1 && addable[0] ? (
        <button type="button" onClick={() => onAdd(addable[0]?.key ?? '')} className={ADD_ROW}>
          {addIcon}
          {copy.addBlock}
        </button>
      ) : null}
      {addable.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className={ADD_ROW}>
                {addIcon}
                {copy.addBlock}
              </button>
            }
          />
          <DropdownMenuContent align="start" side="right" className="min-w-40">
            {addable.map((list) => (
              <DropdownMenuItem key={list.key} onClick={() => onAdd(list.key)}>
                <Plus aria-hidden />
                {copy.addBlockTo(list.label)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
