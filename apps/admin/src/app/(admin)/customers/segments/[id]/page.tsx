import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import SegmentForm from '@/components/customers/segment-form'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Segment' }

type Params = { params: Promise<{ id: string }> }

export default async function Page({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const segment = await call(appRouter.customers.segment, { id }, { context }).catch(
    () => undefined,
  )
  if (segment === undefined) redirect('/select-store')
  if (!segment) notFound()
  return <SegmentForm id={segment.id} initialName={segment.name} initialRules={segment.rules} />
}
