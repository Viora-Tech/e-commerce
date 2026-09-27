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
import type { BlockList } from '@/lib/customize-insert'

type SectionBlocksProps = {
  lists: BlockList[]
  onSelect: () => void
  onAdd: (key: string) => void
  onRemove: (key: string, index: number) => void
}

const copy = customizeContent.tree

const ADD_ROW =
  'flex h-7 w-full items-center gap-2 rounded-md pl-2 text-left text-xs text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted motion-reduce:transition-none'

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
    <span className="flex size-4 items-center justify-center rounded border border-dashed border-border-strong">
      <Plus aria-hidden className="size-2.5" />
    </span>
  )

  return (
    <div className="ml-7 flex flex-col border-l border-border py-0.5 pl-1.5">
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
              className="flex h-7 w-full items-center gap-2 rounded-md pr-7 pl-2 text-left text-xs text-foreground/80 transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none"
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-border-strong" />
              <span className="truncate">{block.title}</span>
            </button>
            {block.canRemove ? (
              <button
                type="button"
                onClick={() => onRemove(block.key, block.index)}
                aria-label={copy.removeBlock(block.title)}
                title={copy.removeBlock(block.title)}
                className="absolute top-1/2 right-1 hidden size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground group-hover/block:flex group-focus-within/block:flex hover:bg-card hover:text-foreground"
              >
                <X aria-hidden className="size-3" />
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
              <button type="button" className={cn(ADD_ROW)}>
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
