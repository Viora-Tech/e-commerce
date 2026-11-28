import ListPageSkeleton from '@/components/layout/list-page-skeleton'

/* Kept on the shared list skeleton, so it does not borrow the Orders list's own one. No stat
   strip (owner, 28 Nov). */
export default function Loading() {
  return <ListPageSkeleton tiles={0} />
}
