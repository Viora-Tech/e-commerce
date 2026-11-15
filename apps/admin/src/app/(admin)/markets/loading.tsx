import MarketsAreaSkeleton from '@/components/markets/markets-area-skeleton'
import { marketsContent } from '@/data/markets'
import { getCopy } from '@/lib/copy-server'

/* The list's own skeleton: its title, the List | Graph switch and the markets table. */
export default async function Loading() {
  const copy = await getCopy(marketsContent)
  return (
    <MarketsAreaSkeleton
      title={copy.title}
      heading={copy.listTitle}
      actions
      columns={[
        { label: copy.columns.market },
        { label: copy.columns.status },
        { label: copy.columns.includes, className: 'hidden sm:table-cell' },
        { label: copy.columns.customizations, className: 'hidden md:table-cell' },
      ]}
    />
  )
}
