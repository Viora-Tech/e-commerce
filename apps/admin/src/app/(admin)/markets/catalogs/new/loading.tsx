import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* A new catalog opens as a form (#84): back link, details, prices and products. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={0} main={3} side={0} />
}
