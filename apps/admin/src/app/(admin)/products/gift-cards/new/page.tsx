import type { Metadata } from 'next'
import IssueGiftCardForm from '@/components/gift-cards/issue-gift-card-form'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: 'Create gift card' }

export default async function NewGiftCardPage() {
  const context = await serverContext()
  // The list carries today's date in the store's time zone, the earliest expiry allowed.
  const { today } = await call(appRouter.giftCards.list, { page: 1, perPage: 1 }, { context })
  return <IssueGiftCardForm today={today} />
}
