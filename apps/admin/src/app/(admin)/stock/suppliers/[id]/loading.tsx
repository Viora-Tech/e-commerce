import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Delete and Save; details and contact; terms and orders. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={2} main={2} side={2} />
}
