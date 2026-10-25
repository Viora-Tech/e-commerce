import { Columns } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { bulkEditContent } from '@/data/bulk-edit'
import { useCopy } from '@/hooks/use-copy'
import { COLUMN_DEFS, type ColumnGroup, PINNED_KEYS, STOCK_GROUP_KEY } from './bulk-edit-columns'

type BulkColumnsMenuProps = {
  hidden: Set<string>
  hasStock: boolean
  onToggle: (key: string, shown: boolean) => void
}

const GROUPS: ColumnGroup[] = ['product', 'variant']

/** The "Columns" button: a checkbox per column, so a wide sheet can be narrowed to what is being edited. */
export default function BulkColumnsMenu({ hidden, hasStock, onToggle }: BulkColumnsMenuProps) {
  // Hooks
  const copy = useCopy(bulkEditContent)

  // Helpers
  const nameOf = (key: string) => {
    const name = (copy.columns as Record<string, unknown>)[key]
    return typeof name === 'string' ? name : key
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Columns className="size-4" />
        {copy.columnsMenu.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70dvh] w-64 overflow-y-auto">
        {GROUPS.map((group, i) => (
          <DropdownMenuGroup key={group}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>{copy.columnsMenu.groups[group]}</DropdownMenuLabel>
            {COLUMN_DEFS.filter((d) => d.group === group && !PINNED_KEYS.includes(d.key)).map(
              (d) => (
                <DropdownMenuCheckboxItem
                  key={d.key}
                  checked={!hidden.has(d.key)}
                  onCheckedChange={(shown) => onToggle(d.key, shown)}
                >
                  {nameOf(d.key)}
                </DropdownMenuCheckboxItem>
              ),
            )}
            {group === 'variant' && hasStock ? (
              <DropdownMenuCheckboxItem
                checked={!hidden.has(STOCK_GROUP_KEY)}
                onCheckedChange={(shown) => onToggle(STOCK_GROUP_KEY, shown)}
              >
                {copy.columnsMenu.stock}
              </DropdownMenuCheckboxItem>
            ) : null}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
