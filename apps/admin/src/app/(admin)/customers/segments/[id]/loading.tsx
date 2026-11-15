import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* The segment builder: ProoflyDetailPage with the name and conditions cards, and the
   matching-customers preview in the side column; Delete, Discount, Email and Save on the right. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={4} main={2} side={1} />
}
