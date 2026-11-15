import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* More, Save and Mark as ordered; supplier, lines, charges, landed cost and bills; six side cards. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={3} main={5} side={6} />
}
