import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DraftForm from '@/components/drafts/draft-form'
import { draftsContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: draftsContent.title }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const draft = await call(appRouter.orders.getDraft, { id }, { context })
  if (!draft) notFound()
  // The draft record has no invoice history; the list's row for it does.
  const row = await call(
    appRouter.orders.listDrafts,
    { page: 1, perPage: 10, search: String(draft.number) },
    { context },
  )
  const invoiceSent = row.items.some((d) => d.id === id && d.invoiceSentAt !== null)
  return <DraftForm draft={draft} invoiceSent={invoiceSent} />
}
