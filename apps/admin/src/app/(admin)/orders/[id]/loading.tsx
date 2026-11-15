import DetailPageSkeleton from '@/components/layout/detail-page-skeleton'

/* The order page as it usually opens: Edit, Print and More actions in the header, the Next step
   card, four main cards (items, payment, shipment, timeline) and three side cards (customer,
   delivery route, profit). */
export default function Loading() {
  return <DetailPageSkeleton frame="order" actions={3} main={4} side={3} />
}
