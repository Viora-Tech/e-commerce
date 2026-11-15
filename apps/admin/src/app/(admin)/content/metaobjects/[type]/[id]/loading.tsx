import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Duplicate and Delete; the fields card; status and handle. */
export default function Loading() {
  return <DetailPageSkeleton actions={2} main={1} side={2} />
}
