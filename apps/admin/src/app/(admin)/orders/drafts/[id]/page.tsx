import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import DraftForm from '@/components/drafts/draft-form'
import { draftEditorContent, draftsContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'

type Props = { params: Promise<{ id: string }> }

/** "Draft #2374" in the tab, not "Draft orders" (audit #32). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const context = await serverContext()
  const draft = await call(appRouter.orders.getDraft, { id }, { context }).catch(() => null)
  return { title: draft ? draftEditorContent.editTitle(draft.number) : draftsContent.title }
}

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
