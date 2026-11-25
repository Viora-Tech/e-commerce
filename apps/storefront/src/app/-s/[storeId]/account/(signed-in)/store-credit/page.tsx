import { shopperStoreCredit } from '@commerce/core'
import type { Metadata } from 'next'
import AccountPageHead from '@/components/account/account-page-head'
import StoreCreditHistory from '@/components/account/store-credit-history'
import { accountContent } from '@/data/account'
import { storeTimeZone } from '@/lib/account'
import { accountHistory, historyLimit, shownFrom } from '@/lib/account-history'
import { requireCustomer } from '@/lib/customer-session'
import { inStore } from '@/lib/store-context'

type StoreCreditPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ show?: string | string[] }>
}

export const metadata: Metadata = { title: accountContent.storeCredit.title }

/** The shopper's store credit, read-only: the balance and its newest changes. */
export default async function StoreCreditPage({ params, searchParams }: StoreCreditPageProps) {
  const { storeId } = await params
  const shown = shownFrom((await searchParams).show)
  const me = await requireCustomer(storeId, '/account/store-credit')
  const { credit, timeZone } = await inStore(storeId, async (tx) => ({
    credit: await shopperStoreCredit({ storeId, tx }, me.id, historyLimit(shown)),
    timeZone: await storeTimeZone(tx, storeId),
  }))
  const history = accountHistory(credit.entries, shown)
  return (
    <>
      <AccountPageHead title={accountContent.storeCredit.title} />
      <StoreCreditHistory
        balancePaise={credit.balancePaise}
        entries={history.visible}
        moreHref={history.moreHref}
        timeZone={timeZone}
      />
    </>
  )
}
