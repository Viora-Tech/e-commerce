import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* Save and Mark as ordered; supplier, lines, charges and bills; five side cards. */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={2} main={4} side={5} />
}
