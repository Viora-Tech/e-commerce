import type { Metadata } from 'next'
import DataRequestQueue from '@/components/privacy/data-request-queue'

export const metadata: Metadata = { title: 'Data requests' }

export default function Page() {
  return <DataRequestQueue />
}
