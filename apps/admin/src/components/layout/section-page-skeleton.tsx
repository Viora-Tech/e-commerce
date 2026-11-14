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
}

/**
 * The one loading shape for Settings, Account and app settings pages, inside the section's own
 * layout (its nav rail stays): the page header at its loaded height, then DataCards with field
 * bars. The route's `loading.tsx` draws it, and each page draws the same thing (with its title,
 * card and field counts) while its own data loads, so the screen does not swap one skeleton for
 * another on the way in.
 */
export default function SectionPageSkeleton({
  cards = 2,
  fields = 3,
  title,
  subtitle,
  header = true,
}: SectionPageSkeletonProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {!header ? null : title ? (
        <PageHeader title={title} subtitle={subtitle} />
      ) : (
        <PageHeaderSkeleton actions={0} />
      )}
      {Array.from({ length: cards }, (_, card) => (
        <DataCardSkeleton key={`card-${card.toString()}`} fields={fields} />
      ))}
    </div>
  )
}
