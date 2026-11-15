import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'

type SectionPageSkeletonProps = {
  /** Form cards under the header. */
  cards?: number
  /** Field bars (2.25rem, the field height) in each card. */
  fields?: number
  /** The page's own title and line, once the page knows them (it renders this while it loads). */
  title?: string
  subtitle?: string
  /** `false` when the page already shows its real header above the cards. */
  header?: boolean
  /**
   * A settings page that opens on a list of rows (`SettingsDrill`): one card of this many rows
   * (title on the left, value on the right, 3.25rem each) in place of the form cards.
   */
  rows?: number
}

/**
 * The one loading shape for Settings, Account and app settings pages, inside the section's own
 * layout (its nav rail stays): the page header at its loaded height, then DataCards with field
 * bars (or, for a page that opens on a list of rows, that list). The route's `loading.tsx` draws it, and each page draws the same thing (with its title,
 * card and field counts) while its own data loads, so the screen does not swap one skeleton for
 * another on the way in.
 */
export default function SectionPageSkeleton({
  cards = 2,
  fields = 3,
  title,
  subtitle,
  header = true,
  rows,
}: SectionPageSkeletonProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {!header ? null : title ? (
        <PageHeader title={title} subtitle={subtitle} />
      ) : (
        <PageHeaderSkeleton actions={0} />
      )}
      {rows ? (
        <ul className="flex flex-col overflow-hidden rounded-lg surface-card">
          {Array.from({ length: rows }, (_, row) => (
            <li
              key={`row-${row.toString()}`}
              className="flex items-center gap-3 border-hairline border-b px-5 py-4 last:border-b-0"
            >
              <span className="flex h-5 flex-1 items-center">
                <Skeleton className="h-3.5 w-40" />
              </span>
              <Skeleton className="h-3.5 w-20" />
            </li>
          ))}
        </ul>
      ) : (
        Array.from({ length: cards }, (_, card) => (
          <DataCardSkeleton key={`card-${card.toString()}`} fields={fields} />
        ))
      )}
    </div>
  )
}
