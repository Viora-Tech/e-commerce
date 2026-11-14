import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Save; details, the save-first note, charges and bills; tracking and notes. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={1} main={4} side={2} />
}
