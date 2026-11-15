import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/** Inbox home: header, the to-dos and staff cards, and status and the last 30 days on the side. */
export default function Loading() {
  return <DetailPageSkeleton frame="columns" back={false} actions={1} main={2} side={2} />
}
