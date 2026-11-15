import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** Agent controls: four settings cards, and the summary and agents on the side. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" actions={0} main={4} side={2} />
}
