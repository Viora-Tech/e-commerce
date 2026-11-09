import { draftLabel, orderRef } from '@commerce/core/draft-number'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CheckoutDraftView from '@/components/drafts/checkout-draft-view'
import DraftForm from '@/components/drafts/draft-form'
import { draftEditorContent, draftsContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'

type Props = { params: Promise<{ id: string }> }

/** "Draft #D12" in the tab, not "Draft orders" (audit #32). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const draft = await call(appRouter.orders.getDraft, { id }, { context }).catch(() => null)
  return { title: draft ? draftEditorContent.editTitle(orderRef(draft)) : draftsContent.title }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const draft = await call(appRouter.orders.getDraft, { id }, { context })
  if (!draft) notFound()
  // A shopper's unpaid checkout is shown as they checked it out, with its payment tries.
  if (draft.draftSource === 'checkout') return <CheckoutDraftView draft={draft} />
  // The draft record has no invoice history; the list's row for it does.
  const row = await call(
    appRouter.orders.listDrafts,
    {
      page: 1,
      perPage: 10,
      search: draft.draftNumber ? draftLabel(draft.draftNumber) : String(draft.number),
    },
    { context },
  )
  const invoiceSent = row.items.some((d) => d.id === id && d.invoiceSentAt !== null)
  return <DraftForm draft={draft} invoiceSent={invoiceSent} />
}
