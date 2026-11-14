import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* A new rollout: back link, details, schedule, changes, audience and notes. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={1} main={5} side={0} />
}
