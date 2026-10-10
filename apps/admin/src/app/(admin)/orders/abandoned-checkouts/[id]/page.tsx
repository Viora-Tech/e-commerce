import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AbandonedDetail from '@/components/abandoned/abandoned-detail'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: abandonedDetailContent.title }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const checkout = await call(appRouter.orders.getAbandoned, { id }, { context }).catch(
    (err: { code?: string }) => {
      if (err.code === 'NOT_FOUND') return null
      throw err
    },
  )
  if (!checkout) notFound()
  return <AbandonedDetail checkout={checkout} />
}
