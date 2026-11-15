import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Create blog; the one card listing the blogs; no side column. */
export default function Loading() {
  return <DetailPageSkeleton actions={1} main={1} side={0} />
}
