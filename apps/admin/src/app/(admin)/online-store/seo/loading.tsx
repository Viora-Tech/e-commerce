import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'

/* The SEO page's shape: the header, the score and Fix with AI cards side by side, the issues. */
export default function Loading() {
  return (
    <PageBody aria-busy="true">
      <PageHeaderSkeleton actions={0} />
      <div className="grid gap-6 md:grid-cols-2">
        <DataCardSkeleton fields={0} lines={4} />
        <DataCardSkeleton fields={0} lines={4} />
      </div>
      <DataCardSkeleton fields={1} lines={4} />
    </PageBody>
  )
}
