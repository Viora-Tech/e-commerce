import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* The customer page's shape: ProoflyDetailPage with the header's three buttons (Email, Create
   order, More actions), the four-tile summary strip, the main column (orders, timeline, messages,
   store credit) and the side column (profile, addresses, marketing, business, note, tags). */
export default function Loading() {
  return <DetailPageSkeleton frame="detail" actions={3} strip={4} main={4} side={6} />
}
