import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import GiftCardDetail from '@/components/gift-cards/gift-card-detail'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Gift card' }

type Params = { params: Promise<{ id: string }> }

export default async function GiftCardPage({ params }: Params) {
  const { id } = await params
  const context = await serverContext()
  const card = await call(appRouter.giftCards.get, { id }, { context }).catch(() => undefined)
  if (card === undefined) redirect('/select-store')
  if (!card) notFound()
  return <GiftCardDetail initial={card} />
}
