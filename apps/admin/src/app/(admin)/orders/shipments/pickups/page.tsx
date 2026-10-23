import type { Metadata } from 'next'
import ShipmentsSubpage from '@/components/shipments/shipments-subpage'
import { shipmentsContent } from '@/data/shipments'

export const metadata: Metadata = { title: shipmentsContent.pickupsSheet.title }

export default function Page() {
  return <ShipmentsSubpage kind="pickups" />
}
