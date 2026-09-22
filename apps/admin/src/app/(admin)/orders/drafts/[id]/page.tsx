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
  return <DraftForm draft={draft} />
}
