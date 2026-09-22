import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import TransferForm from '@/components/transfers/transfer-form'
import { transfersContent } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: transfersContent.heading }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const [transfer, locations] = await Promise.all([
    call(appRouter.transfers.get, { id }, { context }),
    call(appRouter.inventory.locations, undefined, { context }),
  ])
  if (!transfer) notFound()

  // Keyed on status so shipping or receiving remounts the form with fresh lines.
  return <TransferForm key={transfer.status} transfer={transfer} locations={locations} />
}
