import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Save and Ship; route, lines and notes; the summary card. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={2} main={3} side={1} />
}
