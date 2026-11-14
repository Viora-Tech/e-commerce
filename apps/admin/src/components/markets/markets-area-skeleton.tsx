import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import SettingsTable, {
  SETTINGS_CELL,
  type SettingsTableColumn,
} from '@/components/settings/settings-table'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'

type MarketsAreaSkeletonProps = {
  title: string
  /** The list's real columns, so the header labels and widths match the loaded table. */
  columns: SettingsTableColumn[]
  /** The title inside the table card (Markets' "Your markets"). */
  heading?: string
  /** The row-actions column at the end (Markets). */
  actions?: boolean
}

/* Placeholder rows: a market list is short. */
const ROWS = 4

/**
 * The Markets, Catalogs and Rollouts lists while their route loads: the real title, the create
 * button, the bar of tabs or the List | Graph switch, and the settings table with its real
 * columns and placeholder rows (was the generic resource table, a different card).
 */
export default function MarketsAreaSkeleton({
  title,
  columns,
  heading,
  actions = false,
}: MarketsAreaSkeletonProps) {
  // Render logic
  return (
    <PageBody>
      <PageHeaderSkeleton title={title} actions={1} />
      <Skeleton className="h-9 w-56 rounded-md" />
      <SettingsTable columns={columns} heading={heading} actions={actions}>
        <TableSkeletonRows
          columns={columns.length + (actions ? 1 : 0)}
          rows={ROWS}
          cellClassName={SETTINGS_CELL}
          label={title}
        />
      </SettingsTable>
    </PageBody>
  )
}
