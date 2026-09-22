import { Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { menusContent } from '@/data/menus'

type MenuAddRowProps = {
  /** The parent the new item goes under; null for the top level. */
  parentTitle: string | null
  /** Level the new item lands on, for indentation. */
  depth: number
  onAdd: () => void
}

const copy = menusContent.editor

/**
 * Indent per level: the dashed plus sits centred on the grip column of the level
 * it adds to (MenuRowContent pads 0.5rem + 2rem per level, its grip is 2rem wide).
 */
const DEPTH_PAD = ['pl-3', 'pl-11', 'pl-19'] as const

/** The inline "add menu item" link: at the foot of the list, or at the end of a parent's children. */
export default function MenuAddRow({ parentTitle, depth, onAdd }: MenuAddRowProps) {
  // Render logic
  const label = parentTitle === null ? copy.addItem : copy.addChild(parentTitle)

  return (
    <li className={cn('list-none', parentTitle === null && 'border-t border-line')}>
      <button
        type="button"
        onClick={onAdd}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 pr-4 text-left text-body font-medium text-primary',
          'hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          DEPTH_PAD[Math.min(depth, DEPTH_PAD.length - 1)],
        )}
      >
        <span className="flex size-6 items-center justify-center rounded-full border border-dashed border-primary/60">
          <Plus className="size-3.5" />
        </span>
        {label}
      </button>
    </li>
  )
}
