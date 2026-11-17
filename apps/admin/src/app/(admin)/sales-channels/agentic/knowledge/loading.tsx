import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** Knowledge base: fact groups, and the status and policies on the side. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" actions={1} main={2} side={2} />
}
