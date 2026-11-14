import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* A rollout: back link, its actions, details, schedule, changes, audience and notes. */
export default function Loading() {
  return <DetailPageSkeleton frame="narrow" back actions={2} main={5} side={0} />
}
