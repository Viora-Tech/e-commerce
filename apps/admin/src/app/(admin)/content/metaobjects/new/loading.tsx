import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Start from blank; the template tiles, no side column. */
export default function Loading() {
  return <DetailPageSkeleton actions={1} main={2} side={0} />
}
