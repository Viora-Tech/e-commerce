import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* A catalog opens as a form (#84): back link, its menu, details, prices, the price table and products. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={1} main={4} side={0} />
}
