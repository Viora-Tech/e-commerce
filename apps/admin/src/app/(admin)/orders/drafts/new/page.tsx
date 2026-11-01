import type { Metadata } from 'next'
import DraftForm from '@/components/drafts/draft-form'
import { draftForCustomer } from '@/components/drafts/draft-form-state'
import { draftEditorContent } from '@/data/drafts'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: draftEditorContent.newTitle }

type Params = { searchParams: Promise<{ customer?: string }> }

/** `?customer=<id>` ("Create order" on a customer's page) starts the draft with them filled in. */
export default async function Page({ searchParams }: Params) {
  const { customer: customerId } = await searchParams
  const found = customerId
    ? await call(
        appRouter.customers.get,
        { id: customerId },
        { context: await serverContext() },
      ).catch(() => null)
    : null
  return <DraftForm draft={null} initial={found ? draftForCustomer(found) : undefined} />
}
