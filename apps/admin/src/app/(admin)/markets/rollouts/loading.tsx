import MarketsAreaSkeleton from '@/components/markets/markets-area-skeleton'
import { rolloutsContent } from '@/data/rollouts'
import { getCopy } from '@/lib/copy-server'

/* The list's own skeleton: its title, the status tabs and the rollouts table. */
export default async function Loading() {
  const copy = await getCopy(rolloutsContent)
  return (
    <MarketsAreaSkeleton
      title={copy.title}
      columns={[
        { label: copy.columns.name },
        { label: copy.columns.status },
        { label: copy.columns.type, className: 'hidden sm:table-cell' },
        { label: copy.columns.start, className: 'hidden md:table-cell' },
        { label: copy.columns.end, className: 'hidden md:table-cell' },
        { label: copy.columns.audience, className: 'hidden lg:table-cell' },
        { label: copy.columns.changes, className: 'hidden xl:table-cell' },
      ]}
    />
  )
}
