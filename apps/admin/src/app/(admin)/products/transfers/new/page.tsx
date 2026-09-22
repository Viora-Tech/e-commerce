import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import TransferForm from '@/components/transfers/transfer-form'
import { transferFormContent } from '@/data/inventory'
import { appRouter, call, serverContext } from '@/lib/api'

export const metadata: Metadata = { title: transferFormContent.newTitle }

export default async function Page() {
  const context = await serverContext()
  const locations = await call(appRouter.inventory.locations, undefined, { context })
  // One location has nowhere to transfer to; the list explains and offers to add one.
  if (locations.length < 2) redirect('/products/transfers')

  return <TransferForm transfer={null} locations={locations} />
}
