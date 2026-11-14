import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Pause, Duplicate and Delete; usage, method, value and minimum cards; status and summary. */
export default function Loading() {
  return <DetailPageSkeleton actions={3} main={4} side={2} />
}
