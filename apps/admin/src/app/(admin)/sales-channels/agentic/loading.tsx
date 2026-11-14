import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** Agentic sales before an agent is live (most stores): header, the steps, two side cards. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" back={false} actions={1} main={1} side={2} />
}
