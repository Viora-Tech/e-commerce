import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Edit order: a header with no buttons, the items and charges cards, and the summary on the side. */
export default function Loading() {
  return <DetailPageSkeleton frame="page" actions={0} main={2} side={1} />
}
