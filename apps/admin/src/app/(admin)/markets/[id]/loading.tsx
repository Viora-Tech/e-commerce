import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* A market: the back link, its menu, the name card, the customized card and the inherited list. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={1} main={3} side={0} />
}
