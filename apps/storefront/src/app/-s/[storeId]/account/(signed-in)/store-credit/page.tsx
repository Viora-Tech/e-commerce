import { shopperStoreCredit } from '@commerce/core'
import type { Metadata } from 'next'
import StoreCreditHistory from '@/components/account/store-credit-history'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type StoreCreditPageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = { title: accountContent.storeCredit.title }

/** The shopper's store credit, read-only: the balance and its newest changes. */
export default async function StoreCreditPage({ params }: StoreCreditPageProps) {
  const { storeId } = await params
  const me = await requireCustomer(storeId, '/account/store-credit')
  const { credit, timeZone } = await inStore(storeId, async (tx) => ({
    credit: await shopperStoreCredit({ storeId, tx }, me.id),
    timeZone: await storeTimeZone(tx, storeId),
  }))
  return (
    <>
      <h1 className="account-page__title">{accountContent.storeCredit.title}</h1>
      <StoreCreditHistory
        balancePaise={credit.balancePaise}
        entries={credit.entries}
        timeZone={timeZone}
      />
    </>
  )
}
