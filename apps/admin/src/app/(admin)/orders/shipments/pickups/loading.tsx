import ShipmentsSubpageSkeleton from '@/components/shipments/shipments-subpage-skeleton'

/* Its own cards and table headers, not the Shipments list's toolbar and tabs. */
export default function Loading() {
  return <ShipmentsSubpageSkeleton kind="pickups" />
}
