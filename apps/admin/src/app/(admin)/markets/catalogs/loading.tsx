import MarketsAreaSkeleton from '@/components/markets/markets-area-skeleton'
import { catalogsContent } from '@/data/catalogs'
import { getCopy } from '@/lib/copy-server'

/* The list's own skeleton: its title, the status tabs and the catalogs table. */
export default async function Loading() {
  const copy = await getCopy(catalogsContent)
  return (
    <MarketsAreaSkeleton
      title={copy.title}
      columns={[
        { label: copy.columns.name },
        { label: copy.columns.status },
        { label: copy.columns.markets, className: 'hidden sm:table-cell' },
        { label: copy.columns.overrides, className: 'hidden lg:table-cell' },
        { label: copy.columns.adjustment, className: 'hidden md:table-cell' },
        { label: copy.columns.products, className: 'text-right' },
      ]}
    />
  )
}
