import type { Metadata } from 'next'
import ShipmentsWorkspace from '@/components/shipments/shipments-workspace'
import { shipmentsContent } from '@/data/shipments'

export const metadata: Metadata = { title: shipmentsContent.title }

export default function Page() {
  return <ShipmentsWorkspace />
}
