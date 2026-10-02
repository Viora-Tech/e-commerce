import type { Metadata } from 'next'
import DataRequestDetail from '@/components/privacy/data-request-detail'

type Params = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Data request' }

export default async function Page({ params }: Params) {
  const { id } = await params
  return <DataRequestDetail id={id} />
}
