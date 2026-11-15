import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* New market: the back link, Cancel and Create, the name card, customized and inherited. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={2} main={3} side={0} />
}
