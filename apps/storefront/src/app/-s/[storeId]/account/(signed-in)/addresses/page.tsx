import { listAddresses } from '@commerce/core'
import type { Metadata } from 'next'
import AddressBook from '@/components/account/address-book'
import { accountContent } from '@/data/account'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type AddressesPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.addresses.title }

export default async function AddressesPage({ params }: AddressesPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account/addresses')
  const addresses = await inStore(storeId, (tx) => listAddresses({ storeId, tx }, me.id))
  return <AddressBook addresses={addresses} />
}
