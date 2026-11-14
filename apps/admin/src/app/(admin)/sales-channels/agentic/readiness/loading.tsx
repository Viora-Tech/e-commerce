import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** Catalog readiness: the issues list, and the score and "what agents read" on the side. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" actions={1} main={1} side={2} />
}
