'use client'

import { Copy, Eye, EyeOff, MoreHorizontal, Plus, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { SortableList } from '@commerce/ui/sortable'
import { arrayItemSortLabels, customizeContent } from '@/data/customize'
import { CHROME_FOCUS, CHROME_ROW_HOVER, CHROME_TRANSITION } from '@/lib/customize-chrome'
import type { LiquidBlockRow, LiquidBlockType } from '@/lib/customize-liquid-tree'

type LiquidSectionBlocksProps = {
  rows: LiquidBlockRow[]
  types: LiquidBlockType[]
  canAdd: boolean
  /** The block whose settings the inspector shows, if it is one of these. */
  activeId: string | null
  onSelect: (row: LiquidBlockRow) => void
  onAdd: (type: string) => void
  onToggleHidden: (index: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onReorder: (ids: string[]) => void
}

type Item = LiquidBlockRow & { id: string }

const copy = customizeContent.tree

const ADD_ROW = cn(
  'flex h-8 w-full items-center gap-2 rounded-lg pl-2 text-left text-[0.8125rem] font-medium text-link data-[popup-open]:bg-muted/60',
  CHROME_ROW_HOVER,
  CHROME_TRANSITION,
  CHROME_FOCUS,
)

const ICON_BUTTON = cn(
  'flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
  CHROME_FOCUS,
)

/**
 * An imported Shopify section's blocks under its Layers row, the way Shopify's editor lists
 * them: "Add block" first (a menu when the schema allows more than one type), then each block
 * by its own text with its type after it, draggable, with hide and a ⋯ menu (duplicate,
 * remove). A hidden block stays listed, dimmed. Clicking one opens its settings alone.
 */
export default function LiquidSectionBlocks({
  rows,
  types,
  canAdd,
  activeId,
  onSelect,
  onAdd,
  onToggleHidden,
  onDuplicate,
  onRemove,
  onReorder,
}: LiquidSectionBlocksProps) {
  // Render logic
  const addIcon = (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-current">
      <Plus aria-hidden className="size-2.5" />
    </span>
  )
  const items: Item[] = rows

  return (
    // The hairline on the left is the tree's indent guide, lined up under the parent's chevron.
    <div className="ml-6 flex flex-col border-l border-border/80 py-0.5 pl-1.5">
      {canAdd && types.length === 1 && types[0] ? (
        <button type="button" onClick={() => onAdd(types[0]?.type ?? '')} className={ADD_ROW}>
          {addIcon}
          {copy.addBlock}
        </button>
      ) : null}
      {canAdd && types.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" className={ADD_ROW}>
                {addIcon}
                {copy.addBlock}
              </button>
            }
          />
          <DropdownMenuContent align="start" side="right" className="max-h-80 min-w-44">
            {types.map((t) => (
              <DropdownMenuItem key={t.type} onClick={() => onAdd(t.type)}>
                {t.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <SortableList
        items={items}
        onReorder={(next) => onReorder(next.map((r) => r.id))}
        getTitle={(row) => row.title}
        labels={arrayItemSortLabels}
        className="flex flex-col"
        renderItem={(row, { handle }) => (
          <div
            className={cn(
              'group/block relative flex h-8 items-center gap-1 rounded-lg pr-1',
              row.id === activeId ? 'bg-primary/10' : CHROME_ROW_HOVER,
              CHROME_TRANSITION,
            )}
          >
            <span className="flex w-5 shrink-0 justify-center opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100">
              {handle}
            </span>
            <button
              type="button"
              onClick={() => onSelect(row)}
              aria-label={copy.selectBlock(row.title)}
              className={cn(
                'flex h-full min-w-0 flex-1 items-center gap-1 text-left text-[0.8125rem]',
                row.hidden ? 'text-muted-foreground/70' : 'text-foreground/85',
                CHROME_FOCUS,
              )}
            >
              <span className="truncate">{row.title}</span>
              {row.typeName ? (
                <span className="truncate text-muted-foreground italic">– {row.typeName}</span>
              ) : null}
            </button>
            <span
              className={cn(
                'shrink-0 items-center gap-0.5',
                row.hidden ? 'flex' : 'hidden group-hover/block:flex group-focus-within/block:flex',
              )}
            >
              <button
                type="button"
                onClick={() => onToggleHidden(row.index)}
                aria-label={row.hidden ? copy.showBlock(row.title) : copy.hideBlock(row.title)}
                title={row.hidden ? copy.showBlock(row.title) : copy.hideBlock(row.title)}
                className={ICON_BUTTON}
              >
                {row.hidden ? (
                  <EyeOff aria-hidden className="size-3.5" />
                ) : (
                  <Eye aria-hidden className="size-3.5" />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={copy.blockMore(row.title)}
                      title={copy.blockMore(row.title)}
                      className={ICON_BUTTON}
                    >
                      <MoreHorizontal aria-hidden className="size-3.5" />
                    </button>
                  }
                />
                <DropdownMenuContent align="end" className="min-w-36">
                  {canAdd ? (
                    <DropdownMenuItem onClick={() => onDuplicate(row.index)}>
                      <Copy aria-hidden />
                      {copy.duplicateBlock}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onClick={() => onRemove(row.index)}>
                    <Trash2 aria-hidden />
                    {copy.removeBlock(row.title)}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
        )}
      />
    </div>
  )
}
