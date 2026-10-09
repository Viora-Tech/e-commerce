'use client'

import {
  ChevronRight,
  FileText,
  FolderOpen,
  Home,
  LinkIcon,
  Package,
  Pencil,
  Trash2,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import type { SortableRowState } from '@commerce/ui/sortable'
import type { ReactNode } from 'react'
import { destinationPath, type MenuItem, menusContent, type NavigationItemType } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'

type MenuRowContentProps = {
  item: MenuItem
  depth: number
  /** The row's surface (landing slot, keyboard lift, overlay) comes from the shared sortable. */
  state: SortableRowState
  /** Descendants travelling with a dragged item, shown as a badge on the overlay. */
  carried?: number
  hasChildren: boolean
  collapsed: boolean
  /** The drag handle, with the sortable listeners attached by the caller. */
  grip: ReactNode
  onToggle?: () => void
  onEdit?: () => void
  onRemove?: () => void
}

/** Left padding per level: 1rem base, then 2rem (MENU_INDENT_REM) per nesting level. */
const DEPTH_PAD = ['pl-2', 'pl-10', 'pl-18'] as const

const TYPE_ICON: Record<NavigationItemType, typeof Home> = {
  home: Home,
  product: Package,
  collection: FolderOpen,
  page: FileText,
  url: LinkIcon,
}

/** One menu row's contents. The tree row and the drag overlay both render this, so they match exactly. */
export default function MenuRowContent({
  item,
  depth,
  state,
  carried = 0,
  hasChildren,
  collapsed,
  grip,
  onToggle,
  onEdit,
  onRemove,
}: MenuRowContentProps) {
  // Hooks
  const { item: copy } = useCopy(menusContent)

  // Render logic
  const TypeIcon = TYPE_ICON[item.type]
  const quiet = state === 'placeholder'
  const toggleLabel = collapsed ? copy.expand(item.title) : copy.collapse(item.title)

  return (
    <div
      className={cn(
        'flex min-h-14 items-center gap-2 pr-3 transition-colors',
        DEPTH_PAD[Math.min(depth, DEPTH_PAD.length - 1)],
        state === 'row' && 'hover:bg-muted/40',
      )}
    >
      {grip}
      <span className="flex size-6 shrink-0 items-center justify-center">
        {hasChildren && onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform duration-200 motion-reduce:transition-none',
                !collapsed && 'rotate-90',
              )}
            />
          </button>
        ) : null}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate text-body font-medium text-foreground">{item.title}</span>
        <span className="flex min-w-0 shrink items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-caption text-muted-foreground">
          <TypeIcon className="size-3.5 shrink-0" />
          <span className="shrink-0">{copy.types[item.type]}</span>
          {item.type === 'home' ? null : (
            <span className="truncate font-mono">{destinationPath(item.type, item.value)}</span>
          )}
        </span>
        {carried > 0 ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 text-caption font-medium text-primary-foreground tabular-nums">
            {copy.carried(carried)}
          </span>
        ) : null}
      </div>
      {onEdit && onRemove ? (
        <div className={cn('flex shrink-0 items-center gap-0.5', quiet && 'invisible')}>
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label={copy.edit}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} aria-label={copy.remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
