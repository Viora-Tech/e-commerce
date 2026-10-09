'use client'

import { MENU_MAX_LEVELS } from '@commerce/core/navigation-tree'
import { SortableTree, type SortableTreeLabels } from '@commerce/ui/sortable'
import { MENU_INDENT_REM, type MenuItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import MenuAddRow from './menu-add-row'
import MenuRowContent from './menu-row-content'

type MenuTreeProps = {
  items: MenuItem[]
  onChange: (items: MenuItem[]) => void
  onEdit: (item: MenuItem) => void
  onRemove: (id: string) => void
  /** Opens the new-item dialog; null adds at the top level. */
  onAdd: (parentId: string | null) => void
}

/** The nestable, draggable list of menu items (Shopify's menu editor), on the shared SortableTree. */
export default function MenuTree({ items, onChange, onEdit, onRemove, onAdd }: MenuTreeProps) {
  // Hooks
  const copy = useCopy(menusContent)
  const labels: SortableTreeLabels = { ...copy.a11y, handle: copy.item.drag }

  // Render logic
  return (
    <>
      <SortableTree
        items={items}
        onChange={onChange}
        getTitle={(item) => item.title}
        labels={labels}
        maxLevels={MENU_MAX_LEVELS}
        indentRem={MENU_INDENT_REM}
        renderRow={(row) => (
          <MenuRowContent
            item={row.item}
            depth={row.depth}
            state={row.state}
            carried={row.carried}
            hasChildren={row.hasChildren}
            collapsed={row.collapsed}
            grip={row.handle}
            onToggle={row.onToggle}
            onEdit={() => onEdit(row.item)}
            onRemove={() => onRemove(row.item.id)}
          />
        )}
        renderAfterGroup={(parent) => (
          <MenuAddRow
            parentTitle={parent.item.title}
            depth={parent.depth + 1}
            onAdd={() => onAdd(parent.id)}
          />
        )}
      />
      <ul>
        <MenuAddRow parentTitle={null} depth={0} onAdd={() => onAdd(null)} />
      </ul>
    </>
  )
}
