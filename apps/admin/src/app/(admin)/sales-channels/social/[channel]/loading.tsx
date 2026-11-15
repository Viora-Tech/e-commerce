import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** A social channel: header, the four tiles, the issues and sales cards, the connection card. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" back={false} actions={1} strip={4} main={2} side={1} />
}
