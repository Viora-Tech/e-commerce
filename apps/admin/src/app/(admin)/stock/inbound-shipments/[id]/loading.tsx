import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Delivered, Delete and Save; details, orders, charges, landed cost and bills; tracking, notes and the glance card. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={3} main={5} side={3} />
}
