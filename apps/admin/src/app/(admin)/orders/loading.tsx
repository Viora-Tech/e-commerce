import OrdersListSkeleton from '@/components/orders/orders-list-skeleton'

/* The Orders list's own skeleton: the loaded page's header, stat strip and table. The other
   Orders lists (drafts, abandoned, returns, shipments, packing slips, bulk edit) have their own
   loading.tsx so they do not borrow this one. */
export default function Loading() {
  return <OrdersListSkeleton />
}
