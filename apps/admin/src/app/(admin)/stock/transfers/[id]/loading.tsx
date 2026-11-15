import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Delete, Save and Ship; route, lines and notes; the summary card. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={3} main={3} side={1} />
}
