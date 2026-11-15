import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { MenuListItem, menusContent } from '@/data/menus'
import type { MenuPlacement } from './placements'

/** Columns of the Menus list; `usedIn` says where the theme and settings place each menu. */
export function menuColumns(
  copy: typeof menusContent,
  usedIn: (m: MenuListItem) => MenuPlacement[],
): ResourceColumnSpec<MenuListItem>[] {
  return [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (m) => m.title,
      hideable: false,
      render: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink-strong">{m.title}</span>
          <span className="truncate text-caption text-muted-foreground">{m.handle}</span>
        </span>
      ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (m) => m.itemCount,
      render: (m) => <span className="tabular-nums">{copy.itemCount(m.itemCount)}</span>,
    },
    {
      id: 'usedIn',
      title: copy.columns.usedIn,
      render: (m) => {
        const placements = usedIn(m)
        return placements.length > 0 ? (
          placements.map((p) => copy.usage[p]).join(', ')
        ) : (
          <span className="text-muted-foreground">{copy.notUsed}</span>
        )
      },
    },
    {
      id: 'status',
      title: copy.columns.status,
      render: (m) => (
        <StatusChip tone={usedIn(m).length > 0 ? 'success' : 'neutral'}>
          {usedIn(m).length > 0 ? copy.status.active : copy.status.unused}
        </StatusChip>
      ),
    },
  ]
}
